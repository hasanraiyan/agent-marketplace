// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'persona_threads_state.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;
/// @nodoc
mixin _$PersonaThreadsState {

 List<PersonaThread> get threads; bool get isLoading; Object? get error;
/// Create a copy of PersonaThreadsState
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PersonaThreadsStateCopyWith<PersonaThreadsState> get copyWith => _$PersonaThreadsStateCopyWithImpl<PersonaThreadsState>(this as PersonaThreadsState, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PersonaThreadsState&&const DeepCollectionEquality().equals(other.threads, threads)&&(identical(other.isLoading, isLoading) || other.isLoading == isLoading)&&const DeepCollectionEquality().equals(other.error, error));
}


@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(threads),isLoading,const DeepCollectionEquality().hash(error));

@override
String toString() {
  return 'PersonaThreadsState(threads: $threads, isLoading: $isLoading, error: $error)';
}


}

/// @nodoc
abstract mixin class $PersonaThreadsStateCopyWith<$Res>  {
  factory $PersonaThreadsStateCopyWith(PersonaThreadsState value, $Res Function(PersonaThreadsState) _then) = _$PersonaThreadsStateCopyWithImpl;
@useResult
$Res call({
 List<PersonaThread> threads, bool isLoading, Object? error
});




}
/// @nodoc
class _$PersonaThreadsStateCopyWithImpl<$Res>
    implements $PersonaThreadsStateCopyWith<$Res> {
  _$PersonaThreadsStateCopyWithImpl(this._self, this._then);

  final PersonaThreadsState _self;
  final $Res Function(PersonaThreadsState) _then;

/// Create a copy of PersonaThreadsState
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? threads = null,Object? isLoading = null,Object? error = freezed,}) {
  return _then(_self.copyWith(
threads: null == threads ? _self.threads : threads // ignore: cast_nullable_to_non_nullable
as List<PersonaThread>,isLoading: null == isLoading ? _self.isLoading : isLoading // ignore: cast_nullable_to_non_nullable
as bool,error: freezed == error ? _self.error : error ,
  ));
}

}


/// Adds pattern-matching-related methods to [PersonaThreadsState].
extension PersonaThreadsStatePatterns on PersonaThreadsState {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PersonaThreadsState value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PersonaThreadsState() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PersonaThreadsState value)  $default,){
final _that = this;
switch (_that) {
case _PersonaThreadsState():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PersonaThreadsState value)?  $default,){
final _that = this;
switch (_that) {
case _PersonaThreadsState() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( List<PersonaThread> threads,  bool isLoading,  Object? error)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PersonaThreadsState() when $default != null:
return $default(_that.threads,_that.isLoading,_that.error);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( List<PersonaThread> threads,  bool isLoading,  Object? error)  $default,) {final _that = this;
switch (_that) {
case _PersonaThreadsState():
return $default(_that.threads,_that.isLoading,_that.error);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( List<PersonaThread> threads,  bool isLoading,  Object? error)?  $default,) {final _that = this;
switch (_that) {
case _PersonaThreadsState() when $default != null:
return $default(_that.threads,_that.isLoading,_that.error);case _:
  return null;

}
}

}

/// @nodoc


class _PersonaThreadsState implements PersonaThreadsState {
  const _PersonaThreadsState({final  List<PersonaThread> threads = const [], this.isLoading = false, this.error}): _threads = threads;
  

 final  List<PersonaThread> _threads;
@override@JsonKey() List<PersonaThread> get threads {
  if (_threads is EqualUnmodifiableListView) return _threads;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_threads);
}

@override@JsonKey() final  bool isLoading;
@override final  Object? error;

/// Create a copy of PersonaThreadsState
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PersonaThreadsStateCopyWith<_PersonaThreadsState> get copyWith => __$PersonaThreadsStateCopyWithImpl<_PersonaThreadsState>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PersonaThreadsState&&const DeepCollectionEquality().equals(other._threads, _threads)&&(identical(other.isLoading, isLoading) || other.isLoading == isLoading)&&const DeepCollectionEquality().equals(other.error, error));
}


@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(_threads),isLoading,const DeepCollectionEquality().hash(error));

@override
String toString() {
  return 'PersonaThreadsState(threads: $threads, isLoading: $isLoading, error: $error)';
}


}

/// @nodoc
abstract mixin class _$PersonaThreadsStateCopyWith<$Res> implements $PersonaThreadsStateCopyWith<$Res> {
  factory _$PersonaThreadsStateCopyWith(_PersonaThreadsState value, $Res Function(_PersonaThreadsState) _then) = __$PersonaThreadsStateCopyWithImpl;
@override @useResult
$Res call({
 List<PersonaThread> threads, bool isLoading, Object? error
});




}
/// @nodoc
class __$PersonaThreadsStateCopyWithImpl<$Res>
    implements _$PersonaThreadsStateCopyWith<$Res> {
  __$PersonaThreadsStateCopyWithImpl(this._self, this._then);

  final _PersonaThreadsState _self;
  final $Res Function(_PersonaThreadsState) _then;

/// Create a copy of PersonaThreadsState
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? threads = null,Object? isLoading = null,Object? error = freezed,}) {
  return _then(_PersonaThreadsState(
threads: null == threads ? _self._threads : threads // ignore: cast_nullable_to_non_nullable
as List<PersonaThread>,isLoading: null == isLoading ? _self.isLoading : isLoading // ignore: cast_nullable_to_non_nullable
as bool,error: freezed == error ? _self.error : error ,
  ));
}


}

// dart format on
