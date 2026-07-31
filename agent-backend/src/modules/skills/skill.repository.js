import Skill from './skill.model.js';
import NotFoundError from '../../utils/errors/NotFoundError.js';
import { PERSONA_DOMAIN } from '../auth/personaPrincipalContext.js';

class SkillRepository {
  async create(skillData) {
    const skill = new Skill(skillData);
    return await skill.save();
  }

  async findById(id) {
    return await Skill.findById(id);
  }

  async findByOwner(userId) {
    return await Skill.find({ ownerId: userId }).sort({ createdAt: -1 });
  }

  async findPublicSkills(query = {}, skip = 0, limit = 20) {
    const { domain, ...restQuery } = query;
    // Developer Platform (AD-03, blueprint Phase 4): same fix as Agent's
    // marketplace search (PR-9) — scope to a Domain instead of leaking
    // every Domain's public skills into one global result set. Defaults
    // to Persona's own Domain, matching every current caller's behavior
    // today (zero observable change: no caller passes `query.domain` yet,
    // and every existing/backfilled Skill has domain: PERSONA_DOMAIN).
    const filter = { ...restQuery, isPublic: true, domain: domain || PERSONA_DOMAIN };

    // Support regex name search if query provides string name
    if (filter.name && typeof filter.name === 'string') {
      filter.name = { $regex: filter.name, $options: 'i' };
    }

    const skills = await Skill.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .populate('ownerId', 'username avatarUrl');

    const total = await Skill.countDocuments(filter);

    return {
      skills,
      pagination: {
        total,
        page: Math.floor(skip / limit) + 1,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async searchSkills(userId, { q, scope = 'mine', limit = 30, domain } = {}) {
    // Developer Platform (AD-03, blueprint Phase 4): the non-'mine' branch
    // is a second occurrence of the same unscoped-global-public-search
    // pattern findPublicSkills had — same fix, same zero-observable-change
    // rationale (see findPublicSkills above).
    const filter = {
      ...(scope === 'mine'
        ? { ownerId: userId }
        : { isPublic: true, domain: domain || PERSONA_DOMAIN }),
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { instructions: { $regex: q, $options: 'i' } },
      ],
    };
    return await Skill.find(filter).limit(limit).sort({ updatedAt: -1 });
  }

  /**
   * Developer Platform (blueprint Phase 9, PR-28): `ownerFilter` replaces
   * the previous bare `userId` — build it with
   * `resourceOwnership.ownerFilterForContext(context)`. For a Persona
   * caller this is exactly `{ ownerId: userId }`, byte-for-byte the same
   * filter this method built inline before. The ownership check stays
   * atomic (one `findOneAndUpdate`, not fetch-then-check), just built from
   * a caller-supplied filter object instead of hardcoding the `ownerId`
   * shape here.
   */
  async update(id, ownerFilter, updateData) {
    const skill = await Skill.findOneAndUpdate(
      { _id: id, ...ownerFilter },
      { $set: updateData },
      { returnDocument: 'after', runValidators: true }
    );

    if (!skill) throw new NotFoundError('Skill not found or unauthorized');
    return skill;
  }

  /** See `update`'s doc comment — identical `ownerFilter` generalization. */
  async delete(id, ownerFilter) {
    const skill = await Skill.findOneAndDelete({ _id: id, ...ownerFilter });
    if (!skill) throw new NotFoundError('Skill not found or unauthorized');
    return skill;
  }

  async deleteManyByOwner(ownerId) {
    return await Skill.deleteMany({ ownerId });
  }

  /**
   * Developer Platform (blueprint Phase 10, PR-53, AD-08 §29): Domain-scoped
   * bulk delete for a Project's async deletion cascade.
   */
  async deleteManyByDomain(domain) {
    return await Skill.deleteMany({ domain });
  }

  /**
   * Developer Platform (blueprint Phase 9, PR-44): a generic, filter-driven
   * list — the low-level primitive AD-07 §19 permits sharing between
   * Persona's marketplace search and Developer discovery, since it does no
   * scoping/visibility reasoning of its own (that lives entirely in the
   * caller-supplied `filter`). Distinct from `findPublicSkills`/
   * `searchSkills` above, which bake in Persona's own visibility rules.
   */
  async search(filter, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;
    return await Skill.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit);
  }

  async count(filter) {
    return await Skill.countDocuments(filter);
  }
}

export default new SkillRepository();
