/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import type { TFunction } from 'i18next'

// Navigation metadata stays independent of settings forms and their dependencies.
export const settingsNavigation = {
  Auth: [
    {
      id: 'basic-auth',
      titleKey: 'Basic Authentication',
    },
    {
      id: 'oauth',
      titleKey: 'OAuth Integrations',
    },
    {
      id: 'passkey',
      titleKey: 'Passkey Authentication',
    },
    {
      id: 'bot-protection',
      titleKey: 'Bot Protection',
    },
    {
      id: 'custom-oauth',
      titleKey: 'Custom OAuth',
    },
  ],
  Billing: [
    {
      id: 'quota',
      titleKey: 'Quota Settings',
    },
    {
      id: 'currency',
      titleKey: 'Currency & Display',
    },
    {
      id: 'model-pricing',
      titleKey: 'Model Pricing',
    },
    {
      id: 'group-pricing',
      titleKey: 'Group Pricing',
    },
    {
      id: 'payment',
      titleKey: 'Payment Gateway',
    },
    {
      id: 'checkin',
      titleKey: 'Check-in Rewards',
    },
  ],
  Content: [
    {
      id: 'dashboard',
      titleKey: 'Data Dashboard',
    },
    {
      id: 'announcements',
      titleKey: 'Announcements',
    },
    {
      id: 'api-info',
      titleKey: 'API Addresses',
    },
    {
      id: 'faq',
      titleKey: 'FAQ',
    },
    {
      id: 'uptime-kuma',
      titleKey: 'Uptime Kuma',
    },
    {
      id: 'chat',
      titleKey: 'Chat Presets',
    },
    {
      id: 'drawing',
      titleKey: 'Drawing',
    },
  ],
  Models: [
    {
      id: 'global',
      titleKey: 'Global Model Configuration',
    },
    {
      id: 'gemini',
      titleKey: 'Gemini',
    },
    {
      id: 'claude',
      titleKey: 'Claude',
    },
    {
      id: 'grok',
      titleKey: 'Grok',
    },
    {
      id: 'model-deployment',
      titleKey: 'Model Deployment',
    },
  ],
  Operations: [
    {
      id: 'behavior',
      titleKey: 'System Behavior',
    },
    {
      id: 'alerts',
      titleKey: 'Monitoring & Alerts',
    },
    {
      id: 'email',
      titleKey: 'SMTP Email',
    },
    {
      id: 'worker',
      titleKey: 'Worker Proxy',
    },
    {
      id: 'logs',
      titleKey: 'Log Maintenance',
    },
    {
      id: 'performance',
      titleKey: 'Performance',
    },
    {
      id: 'update-checker',
      titleKey: 'System maintenance',
    },
  ],
  Policy: [
    {
      id: 'filtering',
      titleKey: 'Request checks',
    },
    {
      id: 'routing',
      titleKey: 'Sessions and retries',
    },
    {
      id: 'health',
      titleKey: 'Channel health',
    },
  ],
  Security: [
    {
      id: 'rate-limit',
      titleKey: 'Rate Limiting',
    },
    {
      id: 'ssrf',
      titleKey: 'SSRF Protection',
    },
    {
      id: 'token-limits',
      titleKey: 'Token Limits',
    },
  ],
  Site: [
    {
      id: 'system-info',
      titleKey: 'System Information',
    },
    {
      id: 'notice',
      titleKey: 'System Notice',
    },
    {
      id: 'header-navigation',
      titleKey: 'Header navigation',
    },
    {
      id: 'sidebar-modules',
      titleKey: 'Sidebar modules',
    },
  ],
} as const

export function getAuthSectionNavItems(t: TFunction) {
  return settingsNavigation.Auth.map((section) => ({
    title: t(section.titleKey),
    url: `/system-settings/auth/${section.id}`,
  }))
}

export function getBillingSectionNavItems(t: TFunction) {
  return settingsNavigation.Billing.map((section) => ({
    title: t(section.titleKey),
    url: `/system-settings/billing/${section.id}`,
  }))
}

export function getContentSectionNavItems(t: TFunction) {
  return settingsNavigation.Content.map((section) => ({
    title: t(section.titleKey),
    url: `/system-settings/content/${section.id}`,
  }))
}

export function getModelsSectionNavItems(t: TFunction) {
  return settingsNavigation.Models.map((section) => ({
    title: t(section.titleKey),
    url: `/system-settings/models/${section.id}`,
  }))
}

export function getOperationsSectionNavItems(t: TFunction) {
  return settingsNavigation.Operations.map((section) => ({
    title: t(section.titleKey),
    url: `/system-settings/operations/${section.id}`,
  }))
}

export function getPolicySectionNavItems(t: TFunction) {
  return settingsNavigation.Policy.map((section) => ({
    title: t(section.titleKey),
    url: `/system-settings/request-policies/${section.id}`,
  }))
}

export function getSecuritySectionNavItems(t: TFunction) {
  return settingsNavigation.Security.map((section) => ({
    title: t(section.titleKey),
    url: `/system-settings/security/${section.id}`,
  }))
}

export function getSiteSectionNavItems(t: TFunction) {
  return settingsNavigation.Site.map((section) => ({
    title: t(section.titleKey),
    url: `/system-settings/site/${section.id}`,
  }))
}
