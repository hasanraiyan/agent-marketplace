import mongoose from 'mongoose';
import Trace from './trace.model.js';
import TraceSpan from './traceSpan.model.js';

// Fields a list row needs — leaves out nothing heavy except the long text.
const LIST_PROJECTION = {
  domain: 1,
  agentId: 1,
  agentName: 1,
  threadId: 1,
  source: 1,
  channel: 1,
  endUserId: 1,
  status: 1,
  model: 1,
  provider: 1,
  input: { $substrCP: [{ $ifNull: ['$input', ''] }, 0, 240] },
  output: { $substrCP: [{ $ifNull: ['$output', ''] }, 0, 240] },
  error: { $substrCP: [{ $ifNull: ['$error', ''] }, 0, 240] },
  startedAt: 1,
  endedAt: 1,
  durationMs: 1,
  usage: 1,
  llmCalls: 1,
  toolCalls: 1,
  toolErrors: 1,
  spanCount: 1,
  'interrupt.kind': 1,
  'interrupt.summary': 1,
  'resume.kind': 1,
  'resume.summary': 1,
  resumedFromTraceId: 1,
  resumedByTraceId: 1,
};

class TraceRepository {
  newId() {
    return new mongoose.Types.ObjectId();
  }

  isValidId(id) {
    return mongoose.isValidObjectId(id);
  }

  async create(doc) {
    return await Trace.create(doc);
  }

  async update(traceId, fields) {
    return await Trace.updateOne({ _id: traceId }, { $set: fields });
  }

  async insertSpans(spans) {
    if (!spans.length) return;
    await TraceSpan.insertMany(spans, { ordered: false });
  }

  async search(filter, { page = 1, limit = 20 } = {}) {
    return await Trace.aggregate([
      { $match: filter },
      { $sort: { startedAt: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      { $project: LIST_PROJECTION },
    ]);
  }

  async count(filter) {
    return await Trace.countDocuments(filter);
  }

  async findOne(filter) {
    return await Trace.findOne(filter).lean();
  }

  async findLatest(filter) {
    return await Trace.findOne(filter).sort({ startedAt: -1 }).select({ _id: 1 }).lean();
  }

  async findSpans(traceId) {
    return await TraceSpan.find({ traceId }).sort({ startedAt: 1 }).lean();
  }

  async aggregateTraces(pipeline) {
    return await Trace.aggregate(pipeline);
  }

  async aggregateSpans(pipeline) {
    return await TraceSpan.aggregate(pipeline);
  }
}

export default new TraceRepository();
