// eventBus.js
// Event bus implementation using Node.js EventEmitter
// Provides a centralized event handling mechanism for the application
import { EventEmitter } from 'events';
const eventBus = new EventEmitter();
export default eventBus;