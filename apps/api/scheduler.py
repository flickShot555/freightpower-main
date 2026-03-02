from __future__ import annotations

from typing import Callable, Any
import threading
import requests
import os
from datetime import datetime

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger


class SchedulerWrapper:
    def __init__(self):
        self._scheduler = BackgroundScheduler()
        self._started = False
        self._lock = threading.Lock()

    def start(self):
        with self._lock:
            if not self._started:
                self._scheduler.start()
                self._started = True

    def add_interval_job(
        self,
        func: Callable[..., Any],
        minutes: int,
        id: str,
        *,
        max_instances: int = 1,
        coalesce: bool = True,
        misfire_grace_time: int | None = 60,
    ):
        # Defaults chosen to reduce log noise and avoid piling up missed runs.
        self._scheduler.add_job(
            func,
            "interval",
            minutes=minutes,
            id=id,
            replace_existing=True,
            max_instances=max_instances,
            coalesce=coalesce,
            misfire_grace_time=misfire_grace_time,
        )
    
    def add_cron_job(self, func: Callable[..., Any], cron_trigger: CronTrigger, id: str):
        """Add a cron-based scheduled job"""
        self._scheduler.add_job(func, trigger=cron_trigger, id=id, replace_existing=True)

    def shutdown(self):
        with self._lock:
            if self._started:
                self._scheduler.shutdown(wait=False)
                self._started = False


# Marketplace views reset function
def reset_marketplace_views_job():
    """
    Reset marketplace view counts for all drivers.
    Runs every Monday at 00:00.
    """
    try:
        print(f"[{datetime.now()}] Running weekly marketplace views reset...")
        
        # Import here to avoid circular imports
        from firebase_admin import firestore
        from .database import db
        import time
        
        # Get all drivers
        drivers_ref = db.collection("drivers")
        drivers_docs = drivers_ref.stream()
        
        reset_count = 0
        for doc in drivers_docs:
            driver_id = doc.id
            driver_data = doc.to_dict()
            
            current_count = driver_data.get("marketplace_views_count", 0)
            
            # Archive current week's count to history
            history = driver_data.get("marketplace_views_history", [])
            if current_count > 0:
                history.append({
                    "count": current_count,
                    "week_ending": time.time(),
                    "archived_at": time.time()
                })
            
            # Keep only last 12 weeks of history
            if len(history) > 12:
                history = history[-12:]
            
            # Reset count to 0
            doc.reference.update({
                "marketplace_views_count": 0,
                "marketplace_views_last_reset": time.time(),
                "marketplace_views_history": history,
                "updated_at": time.time()
            })
            
            # Also update onboarding collection
            onboarding_ref = db.collection("onboarding").document(driver_id)
            onboarding_doc = onboarding_ref.get()
            if onboarding_doc.exists:
                onboarding_ref.update({
                    "marketplace_views_count": 0,
                    "marketplace_views_last_reset": time.time()
                })
            
            reset_count += 1
        
        print(f"Successfully reset marketplace views for {reset_count} drivers")
    
    except Exception as e:
        print(f"Error in marketplace views reset: {e}")
        import traceback
        traceback.print_exc()


# Initialize scheduler with marketplace reset job
def init_marketplace_scheduler(scheduler_wrapper: SchedulerWrapper):
    """
    Initialize marketplace-related scheduled jobs.
    """
    # Schedule marketplace views reset every Monday at 00:00
    cron_trigger = CronTrigger(day_of_week='mon', hour=0, minute=0)
    scheduler_wrapper.add_cron_job(
        reset_marketplace_views_job,
        cron_trigger,
        'reset_marketplace_views'
    )
    print("Marketplace scheduler initialized: Views reset every Monday at 00:00")

