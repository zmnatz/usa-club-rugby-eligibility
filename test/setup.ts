import { afterEach } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

// Registered before anything imports React, so React DOM sees a document.
GlobalRegistrator.register({ url: 'http://localhost/' });

const { cleanup } = await import('@testing-library/react');

afterEach(cleanup);
