/// The role of a message in a conversation.
///
/// Serializes to/from its lowercase name ("user"/"assistant"/"system") via
/// json_serializable's default enum handling — matches the wire values
/// exactly, no custom converter needed.
enum PersonaRole { user, assistant, system }
