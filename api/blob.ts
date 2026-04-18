import { createApp } from './_create-app.js';
import { blobRouter } from './_blob-routes.js';
export default createApp('/api/blob', blobRouter);
