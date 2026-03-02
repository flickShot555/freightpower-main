import {
  chatWithRoleAssistant,
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
