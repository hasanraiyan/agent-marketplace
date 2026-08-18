// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'persona_mcp_connections_state.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;
/// @nodoc
mixin _$PersonaMcpConnectionsState {

 List<PersonaMcpConnection> get connections; bool get isLoading; Object? get error;
/// Create a copy of PersonaMcpConnectionsState
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PersonaMcpConnectionsStateCopyWith<PersonaMcpConnectionsState> get copyWith => _$PersonaMcpConnectionsStateCopyWithImpl<PersonaMcpConnectionsState>(this as PersonaMcpConnectionsState, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PersonaMcpConnectionsState&&const DeepCollectionEquality().equals(other.connections, connections)&&(identical(other.isLoading, isLoading) || other.isLoading == isLoading)&&const DeepCollectionEquality().equals(other.error, error));
}


@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(connections),isLoading,const DeepCollectionEquality().hash(error));

@override
String toString() {
  return 'PersonaMcpConnectionsState(connections: $connections, isLoading: $isLoading, error: $error)';
}


}

/// @nodoc
abstract mixin class $PersonaMcpConnectionsStateCopyWith<$Res>  {
  factory $PersonaMcpConnectionsStateCopyWith(PersonaMcpConnectionsState value, $Res Function(PersonaMcpConnectionsState) _then) = _$PersonaMcpConnectionsStateCopyWithImpl;
@useResult
$Res call({
 List<PersonaMcpConnection> connections, bool isLoading, Object? error
});




}
/// @nodoc
class _$PersonaMcpConnectionsStateCopyWithImpl<$Res>
    implements $PersonaMcpConnectionsStateCopyWith<$Res> {
  _$PersonaMcpConnectionsStateCopyWithImpl(this._self, this._then);

  final PersonaMcpConnectionsState _self;
  final $Res Function(PersonaMcpConnectionsState) _then;

/// Create a copy of PersonaMcpConnectionsState
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? connections = null,Object? isLoading = null,Object? error = freezed,}) {
  return _then(_self.copyWith(
connections: null == connections ? _self.connections : connections // ignore: cast_nullable_to_non_nullable
as List<PersonaMcpConnection>,isLoading: null == isLoading ? _self.isLoading : isLoading // ignore: cast_nullable_to_non_nullable
as bool,error: freezed == error ? _self.error : error ,
  ));
}

}


/// Adds pattern-matching-related methods to [PersonaMcpConnectionsState].
extension PersonaMcpConnectionsStatePatterns on PersonaMcpConnectionsState {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PersonaMcpConnectionsState value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PersonaMcpConnectionsState() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PersonaMcpConnectionsState value)  $default,){
final _that = this;
switch (_that) {
case _PersonaMcpConnectionsState():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PersonaMcpConnectionsState value)?  $default,){
final _that = this;
switch (_that) {
case _PersonaMcpConnectionsState() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( List<PersonaMcpConnection> connections,  bool isLoading,  Object? error)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PersonaMcpConnectionsState() when $default != null:
return $default(_that.connections,_that.isLoading,_that.error);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( List<PersonaMcpConnection> connections,  bool isLoading,  Object? error)  $default,) {final _that = this;
switch (_that) {
case _PersonaMcpConnectionsState():
return $default(_that.connections,_that.isLoading,_that.error);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( List<PersonaMcpConnection> connections,  bool isLoading,  Object? error)?  $default,) {final _that = this;
switch (_that) {
case _PersonaMcpConnectionsState() when $default != null:
return $default(_that.connections,_that.isLoading,_that.error);case _:
  return null;

}
}

}

/// @nodoc


class _PersonaMcpConnectionsState extends PersonaMcpConnectionsState {
  const _PersonaMcpConnectionsState({final  List<PersonaMcpConnection> connections = const [], this.isLoading = false, this.error}): _connections = connections,super._();
  

 final  List<PersonaMcpConnection> _connections;
@override@JsonKey() List<PersonaMcpConnection> get connections {
  if (_connections is EqualUnmodifiableListView) return _connections;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_connections);
}

@override@JsonKey() final  bool isLoading;
@override final  Object? error;

/// Create a copy of PersonaMcpConnectionsState
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PersonaMcpConnectionsStateCopyWith<_PersonaMcpConnectionsState> get copyWith => __$PersonaMcpConnectionsStateCopyWithImpl<_PersonaMcpConnectionsState>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PersonaMcpConnectionsState&&const DeepCollectionEquality().equals(other._connections, _connections)&&(identical(other.isLoading, isLoading) || other.isLoading == isLoading)&&const DeepCollectionEquality().equals(other.error, error));
}


@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(_connections),isLoading,const DeepCollectionEquality().hash(error));

@override
String toString() {
  return 'PersonaMcpConnectionsState(connections: $connections, isLoading: $isLoading, error: $error)';
}


}

/// @nodoc
abstract mixin class _$PersonaMcpConnectionsStateCopyWith<$Res> implements $PersonaMcpConnectionsStateCopyWith<$Res> {
  factory _$PersonaMcpConnectionsStateCopyWith(_PersonaMcpConnectionsState value, $Res Function(_PersonaMcpConnectionsState) _then) = __$PersonaMcpConnectionsStateCopyWithImpl;
@override @useResult
$Res call({
 List<PersonaMcpConnection> connections, bool isLoading, Object? error
});




}
/// @nodoc
class __$PersonaMcpConnectionsStateCopyWithImpl<$Res>
    implements _$PersonaMcpConnectionsStateCopyWith<$Res> {
  __$PersonaMcpConnectionsStateCopyWithImpl(this._self, this._then);

  final _PersonaMcpConnectionsState _self;
  final $Res Function(_PersonaMcpConnectionsState) _then;

/// Create a copy of PersonaMcpConnectionsState
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? connections = null,Object? isLoading = null,Object? error = freezed,}) {
  return _then(_PersonaMcpConnectionsState(
connections: null == connections ? _self._connections : connections // ignore: cast_nullable_to_non_nullable
as List<PersonaMcpConnection>,isLoading: null == isLoading ? _self.isLoading : isLoading // ignore: cast_nullable_to_non_nullable
as bool,error: freezed == error ? _self.error : error ,
  ));
}


}

// dart format on
