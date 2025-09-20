export { eventBus } from './EventBus';
export {
  eventScheduler,
  SCHEDULER_EVENTS,
  registerSchedulerCondition,
  type SchedulerEventContent,
  type SchedulerChoice,
  type ActiveSchedulerEvent,
  type SchedulerTriggeredPayload,
  type SchedulerResolvedPayload
} from './scheduler';

// register policy listeners
import './policies';
// register building listeners
import '../buildings/effects.ts';
// register audio listeners
import '../audio/events.ts';
