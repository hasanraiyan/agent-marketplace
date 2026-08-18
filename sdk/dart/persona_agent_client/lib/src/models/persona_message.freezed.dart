// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'persona_message.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$PersonaMessage {

 String get id; PersonaRole get role; String get content; DateTime get createdAt; bool get isStreaming; List<PersonaToolCall>? get toolCalls;/// Model reasoning/thinking text streamed ahead of the final answer,
/// when the provider exposes it.
 String? get reasoning; bool get isReasoning;
/// Create a copy of PersonaMessage
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PersonaMessageCopyWith<PersonaMessage> get copyWith => _$PersonaMessageCopyWithImpl<PersonaMessage>(this as PersonaMessage, _$identity);

  /// Serializes this PersonaMessage to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PersonaMessage&&(identical(other.id, id) || other.id == id)&&(identical(other.role, role) || other.role == role)&&(identical(other.content, content) || other.content == content)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.isStreaming, isStreaming) || other.isStreaming == isStreaming)&&const DeepCollectionEquality().equals(other.toolCalls, toolCalls)&&(identical(other.reasoning, reasoning) || other.reasoning == reasoning)&&(identical(other.isReasoning, isReasoning) || other.isReasoning == isReasoning));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,role,content,createdAt,isStreaming,const DeepCollectionEquality().hash(toolCalls),reasoning,isReasoning);

@override
String toString() {
  return 'PersonaMessage(id: $id, role: $role, content: $content, createdAt: $createdAt, isStreaming: $isStreaming, toolCalls: $toolCalls, reasoning: $reasoning, isReasoning: $isReasoning)';
}


}

/// @nodoc
abstract mixin class $PersonaMessageCopyWith<$Res>  {
  factory $PersonaMessageCopyWith(PersonaMessage value, $Res Function(PersonaMessage) _then) = _$PersonaMessageCopyWithImpl;
@useResult
$Res call({
 String id, PersonaRole role, String content, DateTime createdAt, bool isStreaming, List<PersonaToolCall>? toolCalls, String? reasoning, bool isReasoning
});




}
/// @nodoc
class _$PersonaMessageCopyWithImpl<$Res>
    implements $PersonaMessageCopyWith<$Res> {
  _$PersonaMessageCopyWithImpl(this._self, this._then);

  final PersonaMessage _self;
  final $Res Function(PersonaMessage) _then;

/// Create a copy of PersonaMessage
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? role = null,Object? content = null,Object? createdAt = null,Object? isStreaming = null,Object? toolCalls = freezed,Object? reasoning = freezed,Object? isReasoning = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,role: null == role ? _self.role : role // ignore: cast_nullable_to_non_nullable
as PersonaRole,content: null == content ? _self.content : content // ignore: cast_nullable_to_non_nullable
as String,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime,isStreaming: null == isStreaming ? _self.isStreaming : isStreaming // ignore: cast_nullable_to_non_nullable
as bool,toolCalls: freezed == toolCalls ? _self.toolCalls : toolCalls // ignore: cast_nullable_to_non_nullable
as List<PersonaToolCall>?,reasoning: freezed == reasoning ? _self.reasoning : reasoning // ignore: cast_nullable_to_non_nullable
as String?,isReasoning: null == isReasoning ? _self.isReasoning : isReasoning // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [PersonaMessage].
extension PersonaMessagePatterns on PersonaMessage {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PersonaMessage value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PersonaMessage() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PersonaMessage value)  $default,){
final _that = this;
switch (_that) {
case _PersonaMessage():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PersonaMessage value)?  $default,){
final _that = this;
switch (_that) {
case _PersonaMessage() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  PersonaRole role,  String content,  DateTime createdAt,  bool isStreaming,  List<PersonaToolCall>? toolCalls,  String? reasoning,  bool isReasoning)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PersonaMessage() when $default != null:
return $default(_that.id,_that.role,_that.content,_that.createdAt,_that.isStreaming,_that.toolCalls,_that.reasoning,_that.isReasoning);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  PersonaRole role,  String content,  DateTime createdAt,  bool isStreaming,  List<PersonaToolCall>? toolCalls,  String? reasoning,  bool isReasoning)  $default,) {final _that = this;
switch (_that) {
case _PersonaMessage():
return $default(_that.id,_that.role,_that.content,_that.createdAt,_that.isStreaming,_that.toolCalls,_that.reasoning,_that.isReasoning);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  PersonaRole role,  String content,  DateTime createdAt,  bool isStreaming,  List<PersonaToolCall>? toolCalls,  String? reasoning,  bool isReasoning)?  $default,) {final _that = this;
switch (_that) {
case _PersonaMessage() when $default != null:
return $default(_that.id,_that.role,_that.content,_that.createdAt,_that.isStreaming,_that.toolCalls,_that.reasoning,_that.isReasoning);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PersonaMessage implements PersonaMessage {
  const _PersonaMessage({required this.id, required this.role, required this.content, required this.createdAt, this.isStreaming = false, final  List<PersonaToolCall>? toolCalls, this.reasoning, this.isReasoning = false}): _toolCalls = toolCalls;
  factory _PersonaMessage.fromJson(Map<String, dynamic> json) => _$PersonaMessageFromJson(json);

@override final  String id;
@override final  PersonaRole role;
@override final  String content;
@override final  DateTime createdAt;
@override@JsonKey() final  bool isStreaming;
 final  List<PersonaToolCall>? _toolCalls;
@override List<PersonaToolCall>? get toolCalls {
  final value = _toolCalls;
  if (value == null) return null;
  if (_toolCalls is EqualUnmodifiableListView) return _toolCalls;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(value);
}

/// Model reasoning/thinking text streamed ahead of the final answer,
/// when the provider exposes it.
@override final  String? reasoning;
@override@JsonKey() final  bool isReasoning;

/// Create a copy of PersonaMessage
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PersonaMessageCopyWith<_PersonaMessage> get copyWith => __$PersonaMessageCopyWithImpl<_PersonaMessage>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PersonaMessageToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PersonaMessage&&(identical(other.id, id) || other.id == id)&&(identical(other.role, role) || other.role == role)&&(identical(other.content, content) || other.content == content)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.isStreaming, isStreaming) || other.isStreaming == isStreaming)&&const DeepCollectionEquality().equals(other._toolCalls, _toolCalls)&&(identical(other.reasoning, reasoning) || other.reasoning == reasoning)&&(identical(other.isReasoning, isReasoning) || other.isReasoning == isReasoning));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,role,content,createdAt,isStreaming,const DeepCollectionEquality().hash(_toolCalls),reasoning,isReasoning);

@override
String toString() {
  return 'PersonaMessage(id: $id, role: $role, content: $content, createdAt: $createdAt, isStreaming: $isStreaming, toolCalls: $toolCalls, reasoning: $reasoning, isReasoning: $isReasoning)';
}


}

/// @nodoc
abstract mixin class _$PersonaMessageCopyWith<$Res> implements $PersonaMessageCopyWith<$Res> {
  factory _$PersonaMessageCopyWith(_PersonaMessage value, $Res Function(_PersonaMessage) _then) = __$PersonaMessageCopyWithImpl;
@override @useResult
$Res call({
 String id, PersonaRole role, String content, DateTime createdAt, bool isStreaming, List<PersonaToolCall>? toolCalls, String? reasoning, bool isReasoning
});




}
/// @nodoc
class __$PersonaMessageCopyWithImpl<$Res>
    implements _$PersonaMessageCopyWith<$Res> {
  __$PersonaMessageCopyWithImpl(this._self, this._then);

  final _PersonaMessage _self;
  final $Res Function(_PersonaMessage) _then;

/// Create a copy of PersonaMessage
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? role = null,Object? content = null,Object? createdAt = null,Object? isStreaming = null,Object? toolCalls = freezed,Object? reasoning = freezed,Object? isReasoning = null,}) {
  return _then(_PersonaMessage(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,role: null == role ? _self.role : role // ignore: cast_nullable_to_non_nullable
as PersonaRole,content: null == content ? _self.content : content // ignore: cast_nullable_to_non_nullable
as String,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime,isStreaming: null == isStreaming ? _self.isStreaming : isStreaming // ignore: cast_nullable_to_non_nullable
as bool,toolCalls: freezed == toolCalls ? _self._toolCalls : toolCalls // ignore: cast_nullable_to_non_nullable
as List<PersonaToolCall>?,reasoning: freezed == reasoning ? _self.reasoning : reasoning // ignore: cast_nullable_to_non_nullable
as String?,isReasoning: null == isReasoning ? _self.isReasoning : isReasoning // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}

// dart format on
