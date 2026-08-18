// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'persona_connection_state.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;
/// @nodoc
mixin _$PersonaConnectionState {

 bool get isConnected; PersonaHealthInfo? get health; bool get isLoading;
/// Create a copy of PersonaConnectionState
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PersonaConnectionStateCopyWith<PersonaConnectionState> get copyWith => _$PersonaConnectionStateCopyWithImpl<PersonaConnectionState>(this as PersonaConnectionState, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PersonaConnectionState&&(identical(other.isConnected, isConnected) || other.isConnected == isConnected)&&(identical(other.health, health) || other.health == health)&&(identical(other.isLoading, isLoading) || other.isLoading == isLoading));
}


@override
int get hashCode => Object.hash(runtimeType,isConnected,health,isLoading);

@override
String toString() {
  return 'PersonaConnectionState(isConnected: $isConnected, health: $health, isLoading: $isLoading)';
}


}

/// @nodoc
abstract mixin class $PersonaConnectionStateCopyWith<$Res>  {
  factory $PersonaConnectionStateCopyWith(PersonaConnectionState value, $Res Function(PersonaConnectionState) _then) = _$PersonaConnectionStateCopyWithImpl;
@useResult
$Res call({
 bool isConnected, PersonaHealthInfo? health, bool isLoading
});


$PersonaHealthInfoCopyWith<$Res>? get health;

}
/// @nodoc
class _$PersonaConnectionStateCopyWithImpl<$Res>
    implements $PersonaConnectionStateCopyWith<$Res> {
  _$PersonaConnectionStateCopyWithImpl(this._self, this._then);

  final PersonaConnectionState _self;
  final $Res Function(PersonaConnectionState) _then;

/// Create a copy of PersonaConnectionState
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? isConnected = null,Object? health = freezed,Object? isLoading = null,}) {
  return _then(_self.copyWith(
isConnected: null == isConnected ? _self.isConnected : isConnected // ignore: cast_nullable_to_non_nullable
as bool,health: freezed == health ? _self.health : health // ignore: cast_nullable_to_non_nullable
as PersonaHealthInfo?,isLoading: null == isLoading ? _self.isLoading : isLoading // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}
/// Create a copy of PersonaConnectionState
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PersonaHealthInfoCopyWith<$Res>? get health {
    if (_self.health == null) {
    return null;
  }

  return $PersonaHealthInfoCopyWith<$Res>(_self.health!, (value) {
    return _then(_self.copyWith(health: value));
  });
}
}


/// Adds pattern-matching-related methods to [PersonaConnectionState].
extension PersonaConnectionStatePatterns on PersonaConnectionState {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PersonaConnectionState value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PersonaConnectionState() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PersonaConnectionState value)  $default,){
final _that = this;
switch (_that) {
case _PersonaConnectionState():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PersonaConnectionState value)?  $default,){
final _that = this;
switch (_that) {
case _PersonaConnectionState() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( bool isConnected,  PersonaHealthInfo? health,  bool isLoading)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PersonaConnectionState() when $default != null:
return $default(_that.isConnected,_that.health,_that.isLoading);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( bool isConnected,  PersonaHealthInfo? health,  bool isLoading)  $default,) {final _that = this;
switch (_that) {
case _PersonaConnectionState():
return $default(_that.isConnected,_that.health,_that.isLoading);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( bool isConnected,  PersonaHealthInfo? health,  bool isLoading)?  $default,) {final _that = this;
switch (_that) {
case _PersonaConnectionState() when $default != null:
return $default(_that.isConnected,_that.health,_that.isLoading);case _:
  return null;

}
}

}

/// @nodoc


class _PersonaConnectionState implements PersonaConnectionState {
  const _PersonaConnectionState({this.isConnected = false, this.health, this.isLoading = false});
  

@override@JsonKey() final  bool isConnected;
@override final  PersonaHealthInfo? health;
@override@JsonKey() final  bool isLoading;

/// Create a copy of PersonaConnectionState
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PersonaConnectionStateCopyWith<_PersonaConnectionState> get copyWith => __$PersonaConnectionStateCopyWithImpl<_PersonaConnectionState>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PersonaConnectionState&&(identical(other.isConnected, isConnected) || other.isConnected == isConnected)&&(identical(other.health, health) || other.health == health)&&(identical(other.isLoading, isLoading) || other.isLoading == isLoading));
}


@override
int get hashCode => Object.hash(runtimeType,isConnected,health,isLoading);

@override
String toString() {
  return 'PersonaConnectionState(isConnected: $isConnected, health: $health, isLoading: $isLoading)';
}


}

/// @nodoc
abstract mixin class _$PersonaConnectionStateCopyWith<$Res> implements $PersonaConnectionStateCopyWith<$Res> {
  factory _$PersonaConnectionStateCopyWith(_PersonaConnectionState value, $Res Function(_PersonaConnectionState) _then) = __$PersonaConnectionStateCopyWithImpl;
@override @useResult
$Res call({
 bool isConnected, PersonaHealthInfo? health, bool isLoading
});


@override $PersonaHealthInfoCopyWith<$Res>? get health;

}
/// @nodoc
class __$PersonaConnectionStateCopyWithImpl<$Res>
    implements _$PersonaConnectionStateCopyWith<$Res> {
  __$PersonaConnectionStateCopyWithImpl(this._self, this._then);

  final _PersonaConnectionState _self;
  final $Res Function(_PersonaConnectionState) _then;

/// Create a copy of PersonaConnectionState
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? isConnected = null,Object? health = freezed,Object? isLoading = null,}) {
  return _then(_PersonaConnectionState(
isConnected: null == isConnected ? _self.isConnected : isConnected // ignore: cast_nullable_to_non_nullable
as bool,health: freezed == health ? _self.health : health // ignore: cast_nullable_to_non_nullable
as PersonaHealthInfo?,isLoading: null == isLoading ? _self.isLoading : isLoading // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

/// Create a copy of PersonaConnectionState
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PersonaHealthInfoCopyWith<$Res>? get health {
    if (_self.health == null) {
    return null;
  }

  return $PersonaHealthInfoCopyWith<$Res>(_self.health!, (value) {
    return _then(_self.copyWith(health: value));
  });
}
}

// dart format on
