import { BaseStore } from '@langchain/langgraph';

export class MongoDBStore extends BaseStore {
  constructor({ client, dbName, collectionName = 'agent_memories' }) {
    super();
    this.client = client;
    this.dbName = dbName;
    this.collectionName = collectionName;
    this._initialized = false;
  }

  getCollection() {
    const db = this.dbName ? this.client.db(this.dbName) : this.client.db();
    return db.collection(this.collectionName);
  }

  async ensureIndexes() {
    if (this._initialized) return;
    try {
      const coll = this.getCollection();
      await coll.createIndex({ namespace: 1, key: 1 }, { unique: true });
      // Create index on value for general search capabilities
      await coll.createIndex({ "value": "text" });
      this._initialized = true;
    } catch (err) {
      // Ignore text index conflicts
    }
  }

  async batch(operations) {
    await this.ensureIndexes();
    const coll = this.getCollection();
    const results = [];

    for (const op of operations) {
      if ('key' in op && 'namespace' in op && !('value' in op)) {
        // GET OPERATION
        const doc = await coll.findOne({ namespace: op.namespace, key: op.key });
        results.push(doc ? {
          value: doc.value,
          key: doc.key,
          namespace: doc.namespace,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt
        } : null);
      } else if ('value' in op) {
        // PUT / DELETE OPERATION
        const now = new Date();
        if (op.value === null) {
          await coll.deleteOne({ namespace: op.namespace, key: op.key });
        } else {
          await coll.updateOne(
            { namespace: op.namespace, key: op.key },
            {
              $set: {
                value: op.value,
                updatedAt: now
              },
              $setOnInsert: {
                createdAt: now
              }
            },
            { upsert: true }
          );
        }
        results.push(null);
      } else if ('namespacePrefix' in op) {
        // SEARCH OPERATION
        const queryDoc = {};
        if (op.namespacePrefix && op.namespacePrefix.length > 0) {
          op.namespacePrefix.forEach((part, idx) => {
            queryDoc[`namespace.${idx}`] = part;
          });
        }
        
        if (op.query) {
          queryDoc.$text = { $search: op.query };
        }

        let cursor = coll.find(queryDoc);
        if (op.offset !== undefined) cursor = cursor.skip(op.offset);
        if (op.limit !== undefined) cursor = cursor.limit(op.limit);

        const docs = await cursor.toArray();
        results.push(docs.map(doc => ({
          value: doc.value,
          key: doc.key,
          namespace: doc.namespace,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt
        })));
      } else if ('matchConditions' in op || (!('key' in op) && !('value' in op) && !('namespacePrefix' in op))) {
        // LIST NAMESPACES OPERATION
        const distinctNamespaces = await coll.distinct('namespace');
        let namespaces = distinctNamespaces.map(ns => Array.isArray(ns) ? ns : [ns]);

        if (op.matchConditions && op.matchConditions.length > 0) {
          namespaces = namespaces.filter(ns => 
            op.matchConditions.every(cond => {
              const path = cond.path.join(':');
              const nsStr = ns.join(':');
              if (cond.matchType === 'prefix') {
                return nsStr.startsWith(path);
              } else if (cond.matchType === 'suffix') {
                return nsStr.endsWith(path);
              }
              return false;
            })
          );
        }

        if (op.maxDepth !== undefined) {
          namespaces = Array.from(
            new Set(namespaces.map(ns => ns.slice(0, op.maxDepth).join(':')))
          ).map(nsStr => nsStr.split(':'));
        }

        namespaces.sort((a, b) => a.join(':').localeCompare(b.join(':')));
        
        const offset = op.offset ?? 0;
        const limit = op.limit ?? namespaces.length;
        results.push(namespaces.slice(offset, offset + limit));
      }
    }

    return results;
  }
}
