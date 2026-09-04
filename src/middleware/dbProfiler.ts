import mongoose from 'mongoose';
import { recordSlowQuery } from '@/modules/performance/slow-query.service.js';

let installed = false;

export function installDbProfiler(): void {
  if (installed) return;
  installed = true;

  mongoose.plugin((schema) => {
    schema.pre(/^find/, function (this: mongoose.Query<unknown, unknown>, next) {
      (this as mongoose.Query<unknown, unknown> & { _perfStart?: number })._perfStart = Date.now();
      next();
    });

    schema.post(/^find/, async function (this: mongoose.Query<unknown, unknown>, result: unknown) {
      const start = (this as mongoose.Query<unknown, unknown> & { _perfStart?: number })._perfStart;
      if (!start) return;
      const durationMs = Date.now() - start;
      const collection = this.model.collection.name;
      const operation = 'find';
      await recordSlowQuery({
        operation,
        collection,
        filter: this.getFilter(),
        durationMs,
        returnedCount: Array.isArray(result) ? result.length : undefined,
      });
    });
  });
}
