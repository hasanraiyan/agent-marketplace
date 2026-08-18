// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'persona_agents_state.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;
/// @nodoc
mixin _$PersonaAgentsState {

 List<PersonaAgentSummary> get agents; bool get isLoading; Object? get error;
/// Create a copy of PersonaAgentsState
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PersonaAgentsStateCopyWith<PersonaAgentsState> get copyWith => _$PersonaAgentsStateCopyWithImpl<PersonaAgentsState>(this as PersonaAgentsState, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PersonaAgentsState&&const DeepCollectionEquality().equals(other.agents, agents)&&(identical(other.isLoading, isLoading) || other.isLoading == isLoading)&&const DeepCollectionEquality().equals(other.error, error));
}


@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(agents),isLoading,const DeepCollectionEquality().hash(error));

@override
String toString() {
  return 'PersonaAgentsState(agents: $agents, isLoading: $isLoading, error: $error)';
}


}

/// @nodoc
abstract mixin class $PersonaAgentsStateCopyWith<$Res>  {
  factory $PersonaAgentsStateCopyWith(PersonaAgentsState value, $Res Function(PersonaAgentsState) _then) = _$PersonaAgentsStateCopyWithImpl;
@useResult
$Res call({
 List<PersonaAgentSummary> agents, bool isLoading, Object? error
});




}
/// @nodoc
class _$PersonaAgentsStateCopyWithImpl<$Res>
    implements $PersonaAgentsStateCopyWith<$Res> {
  _$PersonaAgentsStateCopyWithImpl(this._self, this._then);

  final PersonaAgentsState _self;
  final $Res Function(PersonaAgentsState) _then;

/// Create a copy of PersonaAgentsState
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? agents = null,Object? isLoading = null,Object? error = freezed,}) {
  return _then(_self.copyWith(
agents: null == agents ? _self.agents : agents // ignore: cast_nullable_to_non_nullable
as List<PersonaAgentSummary>,isLoading: null == isLoading ? _self.isLoading : isLoading // ignore: cast_nullable_to_non_nullable
as bool,error: freezed == error ? _self.error : error ,
  ));
}

}


/// Adds pattern-matching-related methods to [PersonaAgentsState].
extension PersonaAgentsStatePatterns on PersonaAgentsState {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PersonaAgentsState value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PersonaAgentsState() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PersonaAgentsState value)  $default,){
final _that = this;
switch (_that) {
case _PersonaAgentsState():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PersonaAgentsState value)?  $default,){
final _that = this;
switch (_that) {
case _PersonaAgentsState() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( List<PersonaAgentSummary> agents,  bool isLoading,  Object? error)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PersonaAgentsState() when $default != null:
return $default(_that.agents,_that.isLoading,_that.error);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( List<PersonaAgentSummary> agents,  bool isLoading,  Object? error)  $default,) {final _that = this;
switch (_that) {
case _PersonaAgentsState():
return $default(_that.agents,_that.isLoading,_that.error);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( List<PersonaAgentSummary> agents,  bool isLoading,  Object? error)?  $default,) {final _that = this;
switch (_that) {
case _PersonaAgentsState() when $default != null:
return $default(_that.agents,_that.isLoading,_that.error);case _:
  return null;

}
}

}

/// @nodoc


class _PersonaAgentsState implements PersonaAgentsState {
  const _PersonaAgentsState({final  List<PersonaAgentSummary> agents = const [], this.isLoading = false, this.error}): _agents = agents;
  

 final  List<PersonaAgentSummary> _agents;
@override@JsonKey() List<PersonaAgentSummary> get agents {
  if (_agents is EqualUnmodifiableListView) return _agents;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_agents);
}

@override@JsonKey() final  bool isLoading;
@override final  Object? error;

/// Create a copy of PersonaAgentsState
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PersonaAgentsStateCopyWith<_PersonaAgentsState> get copyWith => __$PersonaAgentsStateCopyWithImpl<_PersonaAgentsState>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PersonaAgentsState&&const DeepCollectionEquality().equals(other._agents, _agents)&&(identical(other.isLoading, isLoading) || other.isLoading == isLoading)&&const DeepCollectionEquality().equals(other.error, error));
}


@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(_agents),isLoading,const DeepCollectionEquality().hash(error));

@override
String toString() {
  return 'PersonaAgentsState(agents: $agents, isLoading: $isLoading, error: $error)';
}


}

/// @nodoc
abstract mixin class _$PersonaAgentsStateCopyWith<$Res> implements $PersonaAgentsStateCopyWith<$Res> {
  factory _$PersonaAgentsStateCopyWith(_PersonaAgentsState value, $Res Function(_PersonaAgentsState) _then) = __$PersonaAgentsStateCopyWithImpl;
@override @useResult
$Res call({
 List<PersonaAgentSummary> agents, bool isLoading, Object? error
});




}
/// @nodoc
class __$PersonaAgentsStateCopyWithImpl<$Res>
    implements _$PersonaAgentsStateCopyWith<$Res> {
  __$PersonaAgentsStateCopyWithImpl(this._self, this._then);

  final _PersonaAgentsState _self;
  final $Res Function(_PersonaAgentsState) _then;

/// Create a copy of PersonaAgentsState
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? agents = null,Object? isLoading = null,Object? error = freezed,}) {
  return _then(_PersonaAgentsState(
agents: null == agents ? _self._agents : agents // ignore: cast_nullable_to_non_nullable
as List<PersonaAgentSummary>,isLoading: null == isLoading ? _self.isLoading : isLoading // ignore: cast_nullable_to_non_nullable
as bool,error: freezed == error ? _self.error : error ,
  ));
}


}

// dart format on
