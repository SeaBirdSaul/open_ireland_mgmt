// Theme index file to export and combine theme modules
// Provides a single entry point for theme-related utilities
// Imports and re-exports color, typography, and spacing themes
// Individual theme modules are defined in separate files

// Theme exports
export { colors } from './colors.jsx';
export { typography } from './typography.jsx';
export { spacing } from './spacing.jsx';

// Combined theme object
import { colors } from './colors.jsx';
import { typography } from './typography.jsx';
import { spacing } from './spacing.jsx';

export const theme = {
  colors,
  typography,
  spacing,
};

