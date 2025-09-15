export { eventBus } from './EventBus';
export type * from './types.ts';

// register policy listeners
import './policies';
// register building listeners
import '../buildings/effects.ts';
