/**
 * Transport-facing names. They live here rather than in a feature module so a
 * publisher never spells an exchange or a routing key literal (Art. XI).
 */
export const EVENT_EXCHANGE = 'portal.events';
export const EVENT_DEAD_LETTER_EXCHANGE = 'portal.events.dlx';

export const EVENT_REGISTRY = Symbol('EVENT_REGISTRY');
