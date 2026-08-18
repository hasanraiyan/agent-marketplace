// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'persona_memory_state.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;
/// @nodoc
mixin _$PersonaMemoryState {

 PersonaMemoryList? get memory; bool get isLoading; Object? get error;
/// Create a copy of PersonaMemoryState
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PersonaMemoryStateCopyWith<PersonaMemoryState> get copyWith => _$PersonaMemoryStateCopyWithImpl<PersonaMemoryState>(this as PersonaMemoryState, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PersonaMemoryState&&(identical(other.memory, memory) || other.memory == memory)&&(identical(other.isLoading, isLoading) || other.isLoading == isLoading)&&const DeepCollectionEquality().equals(other.error, error));
}


@override
int get hashCode => Object.hash(runtimeType,memory,isLoading,const DeepCollectionEquality().hash(error));

@override
String toString() {
  return 'PersonaMemoryState(memory: $memory, isLoading: $isLoading, error: $error)';
}


}

/// @nodoc
abstract mixin class $PersonaMemoryStateCopyWith<$Res>  {
  factory $PersonaMemoryStateCopyWith(PersonaMemoryState value, $Res Function(PersonaMemoryState) _then) = _$PersonaMemoryStateCopyWithImpl;
@useResult
$Res call({
 PersonaMemoryList? memory, bool isLoading, Object? error
});


$PersonaMemoryListCopyWith<$Res>? get memory;

}
/// @nodoc
class _$PersonaMemoryStateCopyWithImpl<$Res>
    implements $PersonaMemoryStateCopyWith<$Res> {
  _$PersonaMemoryStateCopyWithImpl(this._self, this._then);

  final PersonaMemoryState _self;
  final $Res Function(PersonaMemoryState) _then;

/// Create a copy of PersonaMemoryState
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? memory = freezed,Object? isLoading = null,Object? error = freezed,}) {
  return _then(_self.copyWith(
memory: freezed == memory ? _self.memory : memory // ignore: cast_nullable_to_non_nullable
as PersonaMemoryList?,isLoading: null == isLoading ? _self.isLoading : isLoading // ignore: cast_nullable_to_non_nullable
as bool,error: freezed == error ? _self.error : error ,
  ));
}
/// Create a copy of PersonaMemoryState
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PersonaMemoryListCopyWith<$Res>? get memory {
    if (_self.memory == null) {
    return null;
  }

  return $PersonaMemoryListCopyWith<$Res>(_self.memory!, (value) {
    return _then(_self.copyWith(memory: value));
  });
}
}


/// Adds pattern-matching-related methods to [PersonaMemoryState].
extension PersonaMemoryStatePatterns on PersonaMemoryState {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PersonaMemoryState value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PersonaMemoryState() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PersonaMemoryState value)  $default,){
final _that = this;
switch (_that) {
case _PersonaMemoryState():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PersonaMemoryState value)?  $default,){
final _that = this;
switch (_that) {
case _PersonaMemoryState() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( PersonaMemoryList? memory,  bool isLoading,  Object? error)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PersonaMemoryState() when $default != null:
return $default(_that.memory,_that.isLoading,_that.error);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( PersonaMemoryList? memory,  bool isLoading,  Object? error)  $default,) {final _that = this;
switch (_that) {
case _PersonaMemoryState():
return $default(_that.memory,_that.isLoading,_that.error);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( PersonaMemoryList? memory,  bool isLoading,  Object? error)?  $default,) {final _that = this;
switch (_that) {
case _PersonaMemoryState() when $default != null:
return $default(_that.memory,_that.isLoading,_that.error);case _:
  return null;

}
}

}

/// @nodoc


class _PersonaMemoryState implements PersonaMemoryState {
  const _PersonaMemoryState({this.memory, this.isLoading = false, this.error});
  

@override final  PersonaMemoryList? memory;
@override@JsonKey() final  bool isLoading;
@override final  Object? error;

/// Create a copy of PersonaMemoryState
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PersonaMemoryStateCopyWith<_PersonaMemoryState> get copyWith => __$PersonaMemoryStateCopyWithImpl<_PersonaMemoryState>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PersonaMemoryState&&(identical(other.memory, memory) || other.memory == memory)&&(identical(other.isLoading, isLoading) || other.isLoading == isLoading)&&const DeepCollectionEquality().equals(other.error, error));
}


@override
int get hashCode => Object.hash(runtimeType,memory,isLoading,const DeepCollectionEquality().hash(error));

@override
String toString() {
  return 'PersonaMemoryState(memory: $memory, isLoading: $isLoading, error: $error)';
}


}

/// @nodoc
abstract mixin class _$PersonaMemoryStateCopyWith<$Res> implements $PersonaMemoryStateCopyWith<$Res> {
  factory _$PersonaMemoryStateCopyWith(_PersonaMemoryState value, $Res Function(_PersonaMemoryState) _then) = __$PersonaMemoryStateCopyWithImpl;
@override @useResult
$Res call({
 PersonaMemoryList? memory, bool isLoading, Object? error
});


@override $PersonaMemoryListCopyWith<$Res>? get memory;

}
/// @nodoc
class __$PersonaMemoryStateCopyWithImpl<$Res>
    implements _$PersonaMemoryStateCopyWith<$Res> {
  __$PersonaMemoryStateCopyWithImpl(this._self, this._then);

  final _PersonaMemoryState _self;
  final $Res Function(_PersonaMemoryState) _then;

/// Create a copy of PersonaMemoryState
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? memory = freezed,Object? isLoading = null,Object? error = freezed,}) {
  return _then(_PersonaMemoryState(
memory: freezed == memory ? _self.memory : memory // ignore: cast_nullable_to_non_nullable
as PersonaMemoryList?,isLoading: null == isLoading ? _self.isLoading : isLoading // ignore: cast_nullable_to_non_nullable
as bool,error: freezed == error ? _self.error : error ,
  ));
}

/// Create a copy of PersonaMemoryState
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PersonaMemoryListCopyWith<$Res>? get memory {
    if (_self.memory == null) {
    return null;
  }

  return $PersonaMemoryListCopyWith<$Res>(_self.memory!, (value) {
    return _then(_self.copyWith(memory: value));
  });
}
}

// dart format on
