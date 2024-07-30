export const QUEUES = {
  jobsQueue: 'jobs',
  taskQueues: {
    storeTriggerQueue: 'listPaths',
    fileSyncerQueue: 'tilesCopying',
    jobSyncerQueue: 'send2Catalog',
  },
};

export enum Stage {
  INITIALIZING = 'Initializing',
  PROCESSING = 'Processing',
  FINALIZING = 'Finalizing',
}

export const PERCENTAGES = {
  listPaths: 10,
  tilesCopying: 85,
  send2Catalog: 5,
};
