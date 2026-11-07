declare module '*.yml';

declare module '@config/eligibility.yml' {
  const eligibility: import('./eligibility').EligibilityRules;
  export default eligibility;
}

declare module '@config/sources.yml' {
  const sources: import('../utils/sources').SourcesConfig;
  export default sources;
}

declare module '*.mdx' {
  import type { ComponentType } from 'react';
  const Component: ComponentType;
  export default Component;
}
