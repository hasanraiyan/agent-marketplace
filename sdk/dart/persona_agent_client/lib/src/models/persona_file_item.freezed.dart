// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'persona_file_item.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$PersonaFileItem {

 String get id; String get originalName; String get mimeType; int get size; String? get agentId; String? get threadId; String get createdAt;
/// Create a copy of PersonaFileItem
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PersonaFileItemCopyWith<PersonaFileItem> get copyWith => _$PersonaFileItemCopyWithImpl<PersonaFileItem>(this as PersonaFileItem, _$identity);

  /// Serializes this PersonaFileItem to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PersonaFileItem&&(identical(other.id, id) || other.id == id)&&(identical(other.originalName, originalName) || other.originalName == originalName)&&(identical(other.mimeType, mimeType) || other.mimeType == mimeType)&&(identical(other.size, size) || other.size == size)&&(identical(other.agentId, agentId) || other.agentId == agentId)&&(identical(other.threadId, threadId) || other.threadId == threadId)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,originalName,mimeType,size,agentId,threadId,createdAt);

@override
String toString() {
  return 'PersonaFileItem(id: $id, originalName: $originalName, mimeType: $mimeType, size: $size, agentId: $agentId, threadId: $threadId, createdAt: $createdAt)';
}


}

/// @nodoc
abstract mixin class $PersonaFileItemCopyWith<$Res>  {
  factory $PersonaFileItemCopyWith(PersonaFileItem value, $Res Function(PersonaFileItem) _then) = _$PersonaFileItemCopyWithImpl;
@useResult
$Res call({
 String id, String originalName, String mimeType, int size, String? agentId, String? threadId, String createdAt
});




}
/// @nodoc
class _$PersonaFileItemCopyWithImpl<$Res>
    implements $PersonaFileItemCopyWith<$Res> {
  _$PersonaFileItemCopyWithImpl(this._self, this._then);

  final PersonaFileItem _self;
  final $Res Function(PersonaFileItem) _then;

/// Create a copy of PersonaFileItem
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? originalName = null,Object? mimeType = null,Object? size = null,Object? agentId = freezed,Object? threadId = freezed,Object? createdAt = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,originalName: null == originalName ? _self.originalName : originalName // ignore: cast_nullable_to_non_nullable
as String,mimeType: null == mimeType ? _self.mimeType : mimeType // ignore: cast_nullable_to_non_nullable
as String,size: null == size ? _self.size : size // ignore: cast_nullable_to_non_nullable
as int,agentId: freezed == agentId ? _self.agentId : agentId // ignore: cast_nullable_to_non_nullable
as String?,threadId: freezed == threadId ? _self.threadId : threadId // ignore: cast_nullable_to_non_nullable
as String?,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [PersonaFileItem].
extension PersonaFileItemPatterns on PersonaFileItem {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PersonaFileItem value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PersonaFileItem() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PersonaFileItem value)  $default,){
final _that = this;
switch (_that) {
case _PersonaFileItem():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PersonaFileItem value)?  $default,){
final _that = this;
switch (_that) {
case _PersonaFileItem() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String originalName,  String mimeType,  int size,  String? agentId,  String? threadId,  String createdAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PersonaFileItem() when $default != null:
return $default(_that.id,_that.originalName,_that.mimeType,_that.size,_that.agentId,_that.threadId,_that.createdAt);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String originalName,  String mimeType,  int size,  String? agentId,  String? threadId,  String createdAt)  $default,) {final _that = this;
switch (_that) {
case _PersonaFileItem():
return $default(_that.id,_that.originalName,_that.mimeType,_that.size,_that.agentId,_that.threadId,_that.createdAt);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String originalName,  String mimeType,  int size,  String? agentId,  String? threadId,  String createdAt)?  $default,) {final _that = this;
switch (_that) {
case _PersonaFileItem() when $default != null:
return $default(_that.id,_that.originalName,_that.mimeType,_that.size,_that.agentId,_that.threadId,_that.createdAt);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PersonaFileItem implements PersonaFileItem {
  const _PersonaFileItem({required this.id, required this.originalName, required this.mimeType, required this.size, this.agentId, this.threadId, required this.createdAt});
  factory _PersonaFileItem.fromJson(Map<String, dynamic> json) => _$PersonaFileItemFromJson(json);

@override final  String id;
@override final  String originalName;
@override final  String mimeType;
@override final  int size;
@override final  String? agentId;
@override final  String? threadId;
@override final  String createdAt;

/// Create a copy of PersonaFileItem
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PersonaFileItemCopyWith<_PersonaFileItem> get copyWith => __$PersonaFileItemCopyWithImpl<_PersonaFileItem>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PersonaFileItemToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PersonaFileItem&&(identical(other.id, id) || other.id == id)&&(identical(other.originalName, originalName) || other.originalName == originalName)&&(identical(other.mimeType, mimeType) || other.mimeType == mimeType)&&(identical(other.size, size) || other.size == size)&&(identical(other.agentId, agentId) || other.agentId == agentId)&&(identical(other.threadId, threadId) || other.threadId == threadId)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,originalName,mimeType,size,agentId,threadId,createdAt);

@override
String toString() {
  return 'PersonaFileItem(id: $id, originalName: $originalName, mimeType: $mimeType, size: $size, agentId: $agentId, threadId: $threadId, createdAt: $createdAt)';
}


}

/// @nodoc
abstract mixin class _$PersonaFileItemCopyWith<$Res> implements $PersonaFileItemCopyWith<$Res> {
  factory _$PersonaFileItemCopyWith(_PersonaFileItem value, $Res Function(_PersonaFileItem) _then) = __$PersonaFileItemCopyWithImpl;
@override @useResult
$Res call({
 String id, String originalName, String mimeType, int size, String? agentId, String? threadId, String createdAt
});




}
/// @nodoc
class __$PersonaFileItemCopyWithImpl<$Res>
    implements _$PersonaFileItemCopyWith<$Res> {
  __$PersonaFileItemCopyWithImpl(this._self, this._then);

  final _PersonaFileItem _self;
  final $Res Function(_PersonaFileItem) _then;

/// Create a copy of PersonaFileItem
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? originalName = null,Object? mimeType = null,Object? size = null,Object? agentId = freezed,Object? threadId = freezed,Object? createdAt = null,}) {
  return _then(_PersonaFileItem(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,originalName: null == originalName ? _self.originalName : originalName // ignore: cast_nullable_to_non_nullable
as String,mimeType: null == mimeType ? _self.mimeType : mimeType // ignore: cast_nullable_to_non_nullable
as String,size: null == size ? _self.size : size // ignore: cast_nullable_to_non_nullable
as int,agentId: freezed == agentId ? _self.agentId : agentId // ignore: cast_nullable_to_non_nullable
as String?,threadId: freezed == threadId ? _self.threadId : threadId // ignore: cast_nullable_to_non_nullable
as String?,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}

// dart format on
