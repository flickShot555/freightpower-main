import {
  chatWithRoleAssistant,
  deleteRoleAssistantConversation,
  exportRoleAssistantConversation,
  getRoleAssistantConversation,
  listRoleAssistantConversations,
} from './roleAssistant';

export function chatWithShipperAssistant(payload = {}, options = {}) {
  return chatWithRoleAssistant(payload, options);
}

export function listShipperAssistantConversations(limit = 30, options = {}) {
  return listRoleAssistantConversations(limit, options);
}

export function getShipperAssistantConversation(conversationId, limit = 100, options = {}) {
  return getRoleAssistantConversation(conversationId, limit, options);
}

export function deleteShipperAssistantConversation(conversationId, options = {}) {
  return deleteRoleAssistantConversation(conversationId, options);
}

export function exportShipperAssistantConversation(conversationId, params = {}, options = {}) {
  return exportRoleAssistantConversation(conversationId, params, options);
}
