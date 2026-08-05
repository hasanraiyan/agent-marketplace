import mongoose from 'mongoose';

/**
 * A named, scoped mount point a developer can assign to one or more Agents
 * (`Agent.storeMounts`), generalizing the fixed `/memories/user/`/
 * `/memories/agent/` mounts into arbitrarily-named ones. Always
 * Project-administered (created/managed via a developer credential) —
 * unlike `Skill`, there's no PersonaUser/ExternalUser config-ownership
 * polymorphism to model here, since `scope` already describes how the
 * store's *data* partitions at runtime (see storeNamespace.js), which is a
 * separate concern from who can rename/delete the store's config.
 */
const storeSchema = new mongoose.Schema(
  {
    domain: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 64,
      lowercase: true,
      match: /^[a-z0-9-]+$/,
    },
    description: {
      type: String,
      default: '',
      maxlength: 1024,
    },
    // domain: one shared namespace for the whole Project. externalUser: one
    // namespace per external user, resolved per agent run (see
    // storeNamespace.js) — never changeable after creation, since that
    // would silently reinterpret already-written data's namespace shape.
    scope: {
      type: String,
      enum: ['domain', 'externalUser'],
      required: true,
    },
    // readonly: agents can read but never write (e.g. a shared reference
    // store mounted onto agents serving hundreds of different external
    // users). readwrite: agents can also write_file/edit_file into it.
    accessMode: {
      type: String,
      enum: ['readonly', 'readwrite'],
      default: 'readwrite',
    },
  },
  { timestamps: true }
);

storeSchema.index({ domain: 1, name: 1 }, { unique: true });

const Store = mongoose.model('Store', storeSchema);

export default Store;
