// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'persona_thread.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$PersonaThread {

@JsonKey(name: '_id') String get id;@JsonKey(fromJson: PersonaAgentRef.fromJson, toJson: _agentRefToJson) PersonaAgentRef get agentId; String? get title; bool? get isArchived; String get createdAt; String get updatedAt;
/// Create a copy of PersonaThread
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PersonaThreadCopyWith<PersonaThread> get copyWith => _$PersonaThreadCopyWithImpl<PersonaThread>(this as PersonaThread, _$identity);

  /// Serializes this PersonaThread to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PersonaThread&&(identical(other.id, id) || other.id == id)&&(identical(other.agentId, agentId) || other.agentId == agentId)&&(identical(other.title, title) || other.title == title)&&(identical(other.isArchived, isArchived) || other.isArchived == isArchived)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,agentId,title,isArchived,createdAt,updatedAt);

@override
String toString() {
  return 'PersonaThread(id: $id, agentId: $agentId, title: $title, isArchived: $isArchived, createdAt: $createdAt, updatedAt: $updatedAt)';
}


}

/// @nodoc
abstract mixin class $PersonaThreadCopyWith<$Res>  {
  factory $PersonaThreadCopyWith(PersonaThread value, $Res Function(PersonaThread) _then) = _$PersonaThreadCopyWithImpl;
@useResult
$Res call({
@JsonKey(name: '_id') String id,@JsonKey(fromJson: PersonaAgentRef.fromJson, toJson: _agentRefToJson) PersonaAgentRef agentId, String? title, bool? isArchived, String createdAt, String updatedAt
});




}
/// @nodoc
class _$PersonaThreadCopyWithImpl<$Res>
    implements $PersonaThreadCopyWith<$Res> {
  _$PersonaThreadCopyWithImpl(this._self, this._then);

  final PersonaThread _self;
  final $Res Function(PersonaThread) _then;

/// Create a copy of PersonaThread
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? agentId = null,Object? title = freezed,Object? isArchived = freezed,Object? createdAt = null,Object? updatedAt = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,agentId: null == agentId ? _self.agentId : agentId // ignore: cast_nullable_to_non_nullable
as PersonaAgentRef,title: freezed == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String?,isArchived: freezed == isArchived ? _self.isArchived : isArchived // ignore: cast_nullable_to_non_nullable
as bool?,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as String,updatedAt: null == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [PersonaThread].
extension PersonaThreadPatterns on PersonaThread {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PersonaThread value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PersonaThread() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PersonaThread value)  $default,){
final _that = this;
switch (_that) {
case _PersonaThread():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PersonaThread value)?  $default,){
final _that = this;
switch (_that) {
case _PersonaThread() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function(@JsonKey(name: '_id')  String id, @JsonKey(fromJson: PersonaAgentRef.fromJson, toJson: _agentRefToJson)  PersonaAgentRef agentId,  String? title,  bool? isArchived,  String createdAt,  String updatedAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PersonaThread() when $default != null:
return $default(_that.id,_that.agentId,_that.title,_that.isArchived,_that.createdAt,_that.updatedAt);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function(@JsonKey(name: '_id')  String id, @JsonKey(fromJson: PersonaAgentRef.fromJson, toJson: _agentRefToJson)  PersonaAgentRef agentId,  String? title,  bool? isArchived,  String createdAt,  String updatedAt)  $default,) {final _that = this;
switch (_that) {
case _PersonaThread():
return $default(_that.id,_that.agentId,_that.title,_that.isArchived,_that.createdAt,_that.updatedAt);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function(@JsonKey(name: '_id')  String id, @JsonKey(fromJson: PersonaAgentRef.fromJson, toJson: _agentRefToJson)  PersonaAgentRef agentId,  String? title,  bool? isArchived,  String createdAt,  String updatedAt)?  $default,) {final _that = this;
switch (_that) {
case _PersonaThread() when $default != null:
return $default(_that.id,_that.agentId,_that.title,_that.isArchived,_that.createdAt,_that.updatedAt);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PersonaThread implements PersonaThread {
  const _PersonaThread({@JsonKey(name: '_id') required this.id, @JsonKey(fromJson: PersonaAgentRef.fromJson, toJson: _agentRefToJson) required this.agentId, this.title, this.isArchived, required this.createdAt, required this.updatedAt});
  factory _PersonaThread.fromJson(Map<String, dynamic> json) => _$PersonaThreadFromJson(json);

@override@JsonKey(name: '_id') final  String id;
@override@JsonKey(fromJson: PersonaAgentRef.fromJson, toJson: _agentRefToJson) final  PersonaAgentRef agentId;
@override final  String? title;
@override final  bool? isArchived;
@override final  String createdAt;
@override final  String updatedAt;

/// Create a copy of PersonaThread
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PersonaThreadCopyWith<_PersonaThread> get copyWith => __$PersonaThreadCopyWithImpl<_PersonaThread>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PersonaThreadToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PersonaThread&&(identical(other.id, id) || other.id == id)&&(identical(other.agentId, agentId) || other.agentId == agentId)&&(identical(other.title, title) || other.title == title)&&(identical(other.isArchived, isArchived) || other.isArchived == isArchived)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,agentId,title,isArchived,createdAt,updatedAt);

@override
String toString() {
  return 'PersonaThread(id: $id, agentId: $agentId, title: $title, isArchived: $isArchived, createdAt: $createdAt, updatedAt: $updatedAt)';
}


}

/// @nodoc
abstract mixin class _$PersonaThreadCopyWith<$Res> implements $PersonaThreadCopyWith<$Res> {
  factory _$PersonaThreadCopyWith(_PersonaThread value, $Res Function(_PersonaThread) _then) = __$PersonaThreadCopyWithImpl;
@override @useResult
$Res call({
@JsonKey(name: '_id') String id,@JsonKey(fromJson: PersonaAgentRef.fromJson, toJson: _agentRefToJson) PersonaAgentRef agentId, String? title, bool? isArchived, String createdAt, String updatedAt
});




}
/// @nodoc
class __$PersonaThreadCopyWithImpl<$Res>
    implements _$PersonaThreadCopyWith<$Res> {
  __$PersonaThreadCopyWithImpl(this._self, this._then);

  final _PersonaThread _self;
  final $Res Function(_PersonaThread) _then;

/// Create a copy of PersonaThread
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? agentId = null,Object? title = freezed,Object? isArchived = freezed,Object? createdAt = null,Object? updatedAt = null,}) {
  return _then(_PersonaThread(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,agentId: null == agentId ? _self.agentId : agentId // ignore: cast_nullable_to_non_nullable
as PersonaAgentRef,title: freezed == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String?,isArchived: freezed == isArchived ? _self.isArchived : isArchived // ignore: cast_nullable_to_non_nullable
as bool?,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as String,updatedAt: null == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}

// dart format on
