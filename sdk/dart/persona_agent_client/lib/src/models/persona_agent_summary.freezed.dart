// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'persona_agent_summary.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$PersonaAgentSummary {

@JsonKey(name: '_id') String get id; String get name; String get slug; String? get description; String? get tagline; String? get avatar;
/// Create a copy of PersonaAgentSummary
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PersonaAgentSummaryCopyWith<PersonaAgentSummary> get copyWith => _$PersonaAgentSummaryCopyWithImpl<PersonaAgentSummary>(this as PersonaAgentSummary, _$identity);

  /// Serializes this PersonaAgentSummary to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PersonaAgentSummary&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.slug, slug) || other.slug == slug)&&(identical(other.description, description) || other.description == description)&&(identical(other.tagline, tagline) || other.tagline == tagline)&&(identical(other.avatar, avatar) || other.avatar == avatar));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,slug,description,tagline,avatar);

@override
String toString() {
  return 'PersonaAgentSummary(id: $id, name: $name, slug: $slug, description: $description, tagline: $tagline, avatar: $avatar)';
}


}

/// @nodoc
abstract mixin class $PersonaAgentSummaryCopyWith<$Res>  {
  factory $PersonaAgentSummaryCopyWith(PersonaAgentSummary value, $Res Function(PersonaAgentSummary) _then) = _$PersonaAgentSummaryCopyWithImpl;
@useResult
$Res call({
@JsonKey(name: '_id') String id, String name, String slug, String? description, String? tagline, String? avatar
});




}
/// @nodoc
class _$PersonaAgentSummaryCopyWithImpl<$Res>
    implements $PersonaAgentSummaryCopyWith<$Res> {
  _$PersonaAgentSummaryCopyWithImpl(this._self, this._then);

  final PersonaAgentSummary _self;
  final $Res Function(PersonaAgentSummary) _then;

/// Create a copy of PersonaAgentSummary
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? name = null,Object? slug = null,Object? description = freezed,Object? tagline = freezed,Object? avatar = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,slug: null == slug ? _self.slug : slug // ignore: cast_nullable_to_non_nullable
as String,description: freezed == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String?,tagline: freezed == tagline ? _self.tagline : tagline // ignore: cast_nullable_to_non_nullable
as String?,avatar: freezed == avatar ? _self.avatar : avatar // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [PersonaAgentSummary].
extension PersonaAgentSummaryPatterns on PersonaAgentSummary {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PersonaAgentSummary value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PersonaAgentSummary() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PersonaAgentSummary value)  $default,){
final _that = this;
switch (_that) {
case _PersonaAgentSummary():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PersonaAgentSummary value)?  $default,){
final _that = this;
switch (_that) {
case _PersonaAgentSummary() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function(@JsonKey(name: '_id')  String id,  String name,  String slug,  String? description,  String? tagline,  String? avatar)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PersonaAgentSummary() when $default != null:
return $default(_that.id,_that.name,_that.slug,_that.description,_that.tagline,_that.avatar);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function(@JsonKey(name: '_id')  String id,  String name,  String slug,  String? description,  String? tagline,  String? avatar)  $default,) {final _that = this;
switch (_that) {
case _PersonaAgentSummary():
return $default(_that.id,_that.name,_that.slug,_that.description,_that.tagline,_that.avatar);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function(@JsonKey(name: '_id')  String id,  String name,  String slug,  String? description,  String? tagline,  String? avatar)?  $default,) {final _that = this;
switch (_that) {
case _PersonaAgentSummary() when $default != null:
return $default(_that.id,_that.name,_that.slug,_that.description,_that.tagline,_that.avatar);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PersonaAgentSummary implements PersonaAgentSummary {
  const _PersonaAgentSummary({@JsonKey(name: '_id') required this.id, required this.name, required this.slug, this.description, this.tagline, this.avatar});
  factory _PersonaAgentSummary.fromJson(Map<String, dynamic> json) => _$PersonaAgentSummaryFromJson(json);

@override@JsonKey(name: '_id') final  String id;
@override final  String name;
@override final  String slug;
@override final  String? description;
@override final  String? tagline;
@override final  String? avatar;

/// Create a copy of PersonaAgentSummary
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PersonaAgentSummaryCopyWith<_PersonaAgentSummary> get copyWith => __$PersonaAgentSummaryCopyWithImpl<_PersonaAgentSummary>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PersonaAgentSummaryToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PersonaAgentSummary&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.slug, slug) || other.slug == slug)&&(identical(other.description, description) || other.description == description)&&(identical(other.tagline, tagline) || other.tagline == tagline)&&(identical(other.avatar, avatar) || other.avatar == avatar));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,slug,description,tagline,avatar);

@override
String toString() {
  return 'PersonaAgentSummary(id: $id, name: $name, slug: $slug, description: $description, tagline: $tagline, avatar: $avatar)';
}


}

/// @nodoc
abstract mixin class _$PersonaAgentSummaryCopyWith<$Res> implements $PersonaAgentSummaryCopyWith<$Res> {
  factory _$PersonaAgentSummaryCopyWith(_PersonaAgentSummary value, $Res Function(_PersonaAgentSummary) _then) = __$PersonaAgentSummaryCopyWithImpl;
@override @useResult
$Res call({
@JsonKey(name: '_id') String id, String name, String slug, String? description, String? tagline, String? avatar
});




}
/// @nodoc
class __$PersonaAgentSummaryCopyWithImpl<$Res>
    implements _$PersonaAgentSummaryCopyWith<$Res> {
  __$PersonaAgentSummaryCopyWithImpl(this._self, this._then);

  final _PersonaAgentSummary _self;
  final $Res Function(_PersonaAgentSummary) _then;

/// Create a copy of PersonaAgentSummary
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? name = null,Object? slug = null,Object? description = freezed,Object? tagline = freezed,Object? avatar = freezed,}) {
  return _then(_PersonaAgentSummary(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,slug: null == slug ? _self.slug : slug // ignore: cast_nullable_to_non_nullable
as String,description: freezed == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String?,tagline: freezed == tagline ? _self.tagline : tagline // ignore: cast_nullable_to_non_nullable
as String?,avatar: freezed == avatar ? _self.avatar : avatar // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}

// dart format on
