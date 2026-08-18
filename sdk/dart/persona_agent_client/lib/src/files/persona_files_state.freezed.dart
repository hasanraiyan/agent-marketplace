// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'persona_files_state.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;
/// @nodoc
mixin _$PersonaFilesState {

 List<PersonaFileItem> get files; bool get isLoading; bool get isUploading; Object? get error;
/// Create a copy of PersonaFilesState
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PersonaFilesStateCopyWith<PersonaFilesState> get copyWith => _$PersonaFilesStateCopyWithImpl<PersonaFilesState>(this as PersonaFilesState, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PersonaFilesState&&const DeepCollectionEquality().equals(other.files, files)&&(identical(other.isLoading, isLoading) || other.isLoading == isLoading)&&(identical(other.isUploading, isUploading) || other.isUploading == isUploading)&&const DeepCollectionEquality().equals(other.error, error));
}


@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(files),isLoading,isUploading,const DeepCollectionEquality().hash(error));

@override
String toString() {
  return 'PersonaFilesState(files: $files, isLoading: $isLoading, isUploading: $isUploading, error: $error)';
}


}

/// @nodoc
abstract mixin class $PersonaFilesStateCopyWith<$Res>  {
  factory $PersonaFilesStateCopyWith(PersonaFilesState value, $Res Function(PersonaFilesState) _then) = _$PersonaFilesStateCopyWithImpl;
@useResult
$Res call({
 List<PersonaFileItem> files, bool isLoading, bool isUploading, Object? error
});




}
/// @nodoc
class _$PersonaFilesStateCopyWithImpl<$Res>
    implements $PersonaFilesStateCopyWith<$Res> {
  _$PersonaFilesStateCopyWithImpl(this._self, this._then);

  final PersonaFilesState _self;
  final $Res Function(PersonaFilesState) _then;

/// Create a copy of PersonaFilesState
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? files = null,Object? isLoading = null,Object? isUploading = null,Object? error = freezed,}) {
  return _then(_self.copyWith(
files: null == files ? _self.files : files // ignore: cast_nullable_to_non_nullable
as List<PersonaFileItem>,isLoading: null == isLoading ? _self.isLoading : isLoading // ignore: cast_nullable_to_non_nullable
as bool,isUploading: null == isUploading ? _self.isUploading : isUploading // ignore: cast_nullable_to_non_nullable
as bool,error: freezed == error ? _self.error : error ,
  ));
}

}


/// Adds pattern-matching-related methods to [PersonaFilesState].
extension PersonaFilesStatePatterns on PersonaFilesState {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PersonaFilesState value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PersonaFilesState() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PersonaFilesState value)  $default,){
final _that = this;
switch (_that) {
case _PersonaFilesState():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PersonaFilesState value)?  $default,){
final _that = this;
switch (_that) {
case _PersonaFilesState() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( List<PersonaFileItem> files,  bool isLoading,  bool isUploading,  Object? error)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PersonaFilesState() when $default != null:
return $default(_that.files,_that.isLoading,_that.isUploading,_that.error);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( List<PersonaFileItem> files,  bool isLoading,  bool isUploading,  Object? error)  $default,) {final _that = this;
switch (_that) {
case _PersonaFilesState():
return $default(_that.files,_that.isLoading,_that.isUploading,_that.error);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( List<PersonaFileItem> files,  bool isLoading,  bool isUploading,  Object? error)?  $default,) {final _that = this;
switch (_that) {
case _PersonaFilesState() when $default != null:
return $default(_that.files,_that.isLoading,_that.isUploading,_that.error);case _:
  return null;

}
}

}

/// @nodoc


class _PersonaFilesState implements PersonaFilesState {
  const _PersonaFilesState({final  List<PersonaFileItem> files = const [], this.isLoading = false, this.isUploading = false, this.error}): _files = files;
  

 final  List<PersonaFileItem> _files;
@override@JsonKey() List<PersonaFileItem> get files {
  if (_files is EqualUnmodifiableListView) return _files;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_files);
}

@override@JsonKey() final  bool isLoading;
@override@JsonKey() final  bool isUploading;
@override final  Object? error;

/// Create a copy of PersonaFilesState
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PersonaFilesStateCopyWith<_PersonaFilesState> get copyWith => __$PersonaFilesStateCopyWithImpl<_PersonaFilesState>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PersonaFilesState&&const DeepCollectionEquality().equals(other._files, _files)&&(identical(other.isLoading, isLoading) || other.isLoading == isLoading)&&(identical(other.isUploading, isUploading) || other.isUploading == isUploading)&&const DeepCollectionEquality().equals(other.error, error));
}


@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(_files),isLoading,isUploading,const DeepCollectionEquality().hash(error));

@override
String toString() {
  return 'PersonaFilesState(files: $files, isLoading: $isLoading, isUploading: $isUploading, error: $error)';
}


}

/// @nodoc
abstract mixin class _$PersonaFilesStateCopyWith<$Res> implements $PersonaFilesStateCopyWith<$Res> {
  factory _$PersonaFilesStateCopyWith(_PersonaFilesState value, $Res Function(_PersonaFilesState) _then) = __$PersonaFilesStateCopyWithImpl;
@override @useResult
$Res call({
 List<PersonaFileItem> files, bool isLoading, bool isUploading, Object? error
});




}
/// @nodoc
class __$PersonaFilesStateCopyWithImpl<$Res>
    implements _$PersonaFilesStateCopyWith<$Res> {
  __$PersonaFilesStateCopyWithImpl(this._self, this._then);

  final _PersonaFilesState _self;
  final $Res Function(_PersonaFilesState) _then;

/// Create a copy of PersonaFilesState
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? files = null,Object? isLoading = null,Object? isUploading = null,Object? error = freezed,}) {
  return _then(_PersonaFilesState(
files: null == files ? _self._files : files // ignore: cast_nullable_to_non_nullable
as List<PersonaFileItem>,isLoading: null == isLoading ? _self.isLoading : isLoading // ignore: cast_nullable_to_non_nullable
as bool,isUploading: null == isUploading ? _self.isUploading : isUploading // ignore: cast_nullable_to_non_nullable
as bool,error: freezed == error ? _self.error : error ,
  ));
}


}

// dart format on
