// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'persona_health_info.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$PersonaHealthInfo {

 String get status; String? get version; Map<String, dynamic>? get capabilities;
/// Create a copy of PersonaHealthInfo
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PersonaHealthInfoCopyWith<PersonaHealthInfo> get copyWith => _$PersonaHealthInfoCopyWithImpl<PersonaHealthInfo>(this as PersonaHealthInfo, _$identity);

  /// Serializes this PersonaHealthInfo to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PersonaHealthInfo&&(identical(other.status, status) || other.status == status)&&(identical(other.version, version) || other.version == version)&&const DeepCollectionEquality().equals(other.capabilities, capabilities));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,status,version,const DeepCollectionEquality().hash(capabilities));

@override
String toString() {
  return 'PersonaHealthInfo(status: $status, version: $version, capabilities: $capabilities)';
}


}

/// @nodoc
abstract mixin class $PersonaHealthInfoCopyWith<$Res>  {
  factory $PersonaHealthInfoCopyWith(PersonaHealthInfo value, $Res Function(PersonaHealthInfo) _then) = _$PersonaHealthInfoCopyWithImpl;
@useResult
$Res call({
 String status, String? version, Map<String, dynamic>? capabilities
});




}
/// @nodoc
class _$PersonaHealthInfoCopyWithImpl<$Res>
    implements $PersonaHealthInfoCopyWith<$Res> {
  _$PersonaHealthInfoCopyWithImpl(this._self, this._then);

  final PersonaHealthInfo _self;
  final $Res Function(PersonaHealthInfo) _then;

/// Create a copy of PersonaHealthInfo
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? status = null,Object? version = freezed,Object? capabilities = freezed,}) {
  return _then(_self.copyWith(
status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,version: freezed == version ? _self.version : version // ignore: cast_nullable_to_non_nullable
as String?,capabilities: freezed == capabilities ? _self.capabilities : capabilities // ignore: cast_nullable_to_non_nullable
as Map<String, dynamic>?,
  ));
}

}


/// Adds pattern-matching-related methods to [PersonaHealthInfo].
extension PersonaHealthInfoPatterns on PersonaHealthInfo {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PersonaHealthInfo value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PersonaHealthInfo() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PersonaHealthInfo value)  $default,){
final _that = this;
switch (_that) {
case _PersonaHealthInfo():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PersonaHealthInfo value)?  $default,){
final _that = this;
switch (_that) {
case _PersonaHealthInfo() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String status,  String? version,  Map<String, dynamic>? capabilities)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PersonaHealthInfo() when $default != null:
return $default(_that.status,_that.version,_that.capabilities);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String status,  String? version,  Map<String, dynamic>? capabilities)  $default,) {final _that = this;
switch (_that) {
case _PersonaHealthInfo():
return $default(_that.status,_that.version,_that.capabilities);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String status,  String? version,  Map<String, dynamic>? capabilities)?  $default,) {final _that = this;
switch (_that) {
case _PersonaHealthInfo() when $default != null:
return $default(_that.status,_that.version,_that.capabilities);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PersonaHealthInfo implements PersonaHealthInfo {
  const _PersonaHealthInfo({required this.status, this.version, final  Map<String, dynamic>? capabilities}): _capabilities = capabilities;
  factory _PersonaHealthInfo.fromJson(Map<String, dynamic> json) => _$PersonaHealthInfoFromJson(json);

@override final  String status;
@override final  String? version;
 final  Map<String, dynamic>? _capabilities;
@override Map<String, dynamic>? get capabilities {
  final value = _capabilities;
  if (value == null) return null;
  if (_capabilities is EqualUnmodifiableMapView) return _capabilities;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableMapView(value);
}


/// Create a copy of PersonaHealthInfo
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PersonaHealthInfoCopyWith<_PersonaHealthInfo> get copyWith => __$PersonaHealthInfoCopyWithImpl<_PersonaHealthInfo>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PersonaHealthInfoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PersonaHealthInfo&&(identical(other.status, status) || other.status == status)&&(identical(other.version, version) || other.version == version)&&const DeepCollectionEquality().equals(other._capabilities, _capabilities));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,status,version,const DeepCollectionEquality().hash(_capabilities));

@override
String toString() {
  return 'PersonaHealthInfo(status: $status, version: $version, capabilities: $capabilities)';
}


}

/// @nodoc
abstract mixin class _$PersonaHealthInfoCopyWith<$Res> implements $PersonaHealthInfoCopyWith<$Res> {
  factory _$PersonaHealthInfoCopyWith(_PersonaHealthInfo value, $Res Function(_PersonaHealthInfo) _then) = __$PersonaHealthInfoCopyWithImpl;
@override @useResult
$Res call({
 String status, String? version, Map<String, dynamic>? capabilities
});




}
/// @nodoc
class __$PersonaHealthInfoCopyWithImpl<$Res>
    implements _$PersonaHealthInfoCopyWith<$Res> {
  __$PersonaHealthInfoCopyWithImpl(this._self, this._then);

  final _PersonaHealthInfo _self;
  final $Res Function(_PersonaHealthInfo) _then;

/// Create a copy of PersonaHealthInfo
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? status = null,Object? version = freezed,Object? capabilities = freezed,}) {
  return _then(_PersonaHealthInfo(
status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,version: freezed == version ? _self.version : version // ignore: cast_nullable_to_non_nullable
as String?,capabilities: freezed == capabilities ? _self._capabilities : capabilities // ignore: cast_nullable_to_non_nullable
as Map<String, dynamic>?,
  ));
}


}

// dart format on
