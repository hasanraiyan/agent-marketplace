// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'persona_workspace.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$PersonaWorkspaceFile {

 String get content; int get size; String? get createdAt; String? get modifiedAt;
/// Create a copy of PersonaWorkspaceFile
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PersonaWorkspaceFileCopyWith<PersonaWorkspaceFile> get copyWith => _$PersonaWorkspaceFileCopyWithImpl<PersonaWorkspaceFile>(this as PersonaWorkspaceFile, _$identity);

  /// Serializes this PersonaWorkspaceFile to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PersonaWorkspaceFile&&(identical(other.content, content) || other.content == content)&&(identical(other.size, size) || other.size == size)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.modifiedAt, modifiedAt) || other.modifiedAt == modifiedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,content,size,createdAt,modifiedAt);

@override
String toString() {
  return 'PersonaWorkspaceFile(content: $content, size: $size, createdAt: $createdAt, modifiedAt: $modifiedAt)';
}


}

/// @nodoc
abstract mixin class $PersonaWorkspaceFileCopyWith<$Res>  {
  factory $PersonaWorkspaceFileCopyWith(PersonaWorkspaceFile value, $Res Function(PersonaWorkspaceFile) _then) = _$PersonaWorkspaceFileCopyWithImpl;
@useResult
$Res call({
 String content, int size, String? createdAt, String? modifiedAt
});




}
/// @nodoc
class _$PersonaWorkspaceFileCopyWithImpl<$Res>
    implements $PersonaWorkspaceFileCopyWith<$Res> {
  _$PersonaWorkspaceFileCopyWithImpl(this._self, this._then);

  final PersonaWorkspaceFile _self;
  final $Res Function(PersonaWorkspaceFile) _then;

/// Create a copy of PersonaWorkspaceFile
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? content = null,Object? size = null,Object? createdAt = freezed,Object? modifiedAt = freezed,}) {
  return _then(_self.copyWith(
content: null == content ? _self.content : content // ignore: cast_nullable_to_non_nullable
as String,size: null == size ? _self.size : size // ignore: cast_nullable_to_non_nullable
as int,createdAt: freezed == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as String?,modifiedAt: freezed == modifiedAt ? _self.modifiedAt : modifiedAt // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [PersonaWorkspaceFile].
extension PersonaWorkspaceFilePatterns on PersonaWorkspaceFile {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PersonaWorkspaceFile value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PersonaWorkspaceFile() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PersonaWorkspaceFile value)  $default,){
final _that = this;
switch (_that) {
case _PersonaWorkspaceFile():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PersonaWorkspaceFile value)?  $default,){
final _that = this;
switch (_that) {
case _PersonaWorkspaceFile() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String content,  int size,  String? createdAt,  String? modifiedAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PersonaWorkspaceFile() when $default != null:
return $default(_that.content,_that.size,_that.createdAt,_that.modifiedAt);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String content,  int size,  String? createdAt,  String? modifiedAt)  $default,) {final _that = this;
switch (_that) {
case _PersonaWorkspaceFile():
return $default(_that.content,_that.size,_that.createdAt,_that.modifiedAt);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String content,  int size,  String? createdAt,  String? modifiedAt)?  $default,) {final _that = this;
switch (_that) {
case _PersonaWorkspaceFile() when $default != null:
return $default(_that.content,_that.size,_that.createdAt,_that.modifiedAt);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PersonaWorkspaceFile implements PersonaWorkspaceFile {
  const _PersonaWorkspaceFile({required this.content, required this.size, this.createdAt, this.modifiedAt});
  factory _PersonaWorkspaceFile.fromJson(Map<String, dynamic> json) => _$PersonaWorkspaceFileFromJson(json);

@override final  String content;
@override final  int size;
@override final  String? createdAt;
@override final  String? modifiedAt;

/// Create a copy of PersonaWorkspaceFile
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PersonaWorkspaceFileCopyWith<_PersonaWorkspaceFile> get copyWith => __$PersonaWorkspaceFileCopyWithImpl<_PersonaWorkspaceFile>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PersonaWorkspaceFileToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PersonaWorkspaceFile&&(identical(other.content, content) || other.content == content)&&(identical(other.size, size) || other.size == size)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.modifiedAt, modifiedAt) || other.modifiedAt == modifiedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,content,size,createdAt,modifiedAt);

@override
String toString() {
  return 'PersonaWorkspaceFile(content: $content, size: $size, createdAt: $createdAt, modifiedAt: $modifiedAt)';
}


}

/// @nodoc
abstract mixin class _$PersonaWorkspaceFileCopyWith<$Res> implements $PersonaWorkspaceFileCopyWith<$Res> {
  factory _$PersonaWorkspaceFileCopyWith(_PersonaWorkspaceFile value, $Res Function(_PersonaWorkspaceFile) _then) = __$PersonaWorkspaceFileCopyWithImpl;
@override @useResult
$Res call({
 String content, int size, String? createdAt, String? modifiedAt
});




}
/// @nodoc
class __$PersonaWorkspaceFileCopyWithImpl<$Res>
    implements _$PersonaWorkspaceFileCopyWith<$Res> {
  __$PersonaWorkspaceFileCopyWithImpl(this._self, this._then);

  final _PersonaWorkspaceFile _self;
  final $Res Function(_PersonaWorkspaceFile) _then;

/// Create a copy of PersonaWorkspaceFile
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? content = null,Object? size = null,Object? createdAt = freezed,Object? modifiedAt = freezed,}) {
  return _then(_PersonaWorkspaceFile(
content: null == content ? _self.content : content // ignore: cast_nullable_to_non_nullable
as String,size: null == size ? _self.size : size // ignore: cast_nullable_to_non_nullable
as int,createdAt: freezed == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as String?,modifiedAt: freezed == modifiedAt ? _self.modifiedAt : modifiedAt // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$PersonaTodo {

 String get content; String get status;
/// Create a copy of PersonaTodo
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PersonaTodoCopyWith<PersonaTodo> get copyWith => _$PersonaTodoCopyWithImpl<PersonaTodo>(this as PersonaTodo, _$identity);

  /// Serializes this PersonaTodo to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PersonaTodo&&(identical(other.content, content) || other.content == content)&&(identical(other.status, status) || other.status == status));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,content,status);

@override
String toString() {
  return 'PersonaTodo(content: $content, status: $status)';
}


}

/// @nodoc
abstract mixin class $PersonaTodoCopyWith<$Res>  {
  factory $PersonaTodoCopyWith(PersonaTodo value, $Res Function(PersonaTodo) _then) = _$PersonaTodoCopyWithImpl;
@useResult
$Res call({
 String content, String status
});




}
/// @nodoc
class _$PersonaTodoCopyWithImpl<$Res>
    implements $PersonaTodoCopyWith<$Res> {
  _$PersonaTodoCopyWithImpl(this._self, this._then);

  final PersonaTodo _self;
  final $Res Function(PersonaTodo) _then;

/// Create a copy of PersonaTodo
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? content = null,Object? status = null,}) {
  return _then(_self.copyWith(
content: null == content ? _self.content : content // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [PersonaTodo].
extension PersonaTodoPatterns on PersonaTodo {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PersonaTodo value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PersonaTodo() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PersonaTodo value)  $default,){
final _that = this;
switch (_that) {
case _PersonaTodo():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PersonaTodo value)?  $default,){
final _that = this;
switch (_that) {
case _PersonaTodo() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String content,  String status)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PersonaTodo() when $default != null:
return $default(_that.content,_that.status);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String content,  String status)  $default,) {final _that = this;
switch (_that) {
case _PersonaTodo():
return $default(_that.content,_that.status);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String content,  String status)?  $default,) {final _that = this;
switch (_that) {
case _PersonaTodo() when $default != null:
return $default(_that.content,_that.status);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PersonaTodo implements PersonaTodo {
  const _PersonaTodo({required this.content, required this.status});
  factory _PersonaTodo.fromJson(Map<String, dynamic> json) => _$PersonaTodoFromJson(json);

@override final  String content;
@override final  String status;

/// Create a copy of PersonaTodo
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PersonaTodoCopyWith<_PersonaTodo> get copyWith => __$PersonaTodoCopyWithImpl<_PersonaTodo>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PersonaTodoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PersonaTodo&&(identical(other.content, content) || other.content == content)&&(identical(other.status, status) || other.status == status));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,content,status);

@override
String toString() {
  return 'PersonaTodo(content: $content, status: $status)';
}


}

/// @nodoc
abstract mixin class _$PersonaTodoCopyWith<$Res> implements $PersonaTodoCopyWith<$Res> {
  factory _$PersonaTodoCopyWith(_PersonaTodo value, $Res Function(_PersonaTodo) _then) = __$PersonaTodoCopyWithImpl;
@override @useResult
$Res call({
 String content, String status
});




}
/// @nodoc
class __$PersonaTodoCopyWithImpl<$Res>
    implements _$PersonaTodoCopyWith<$Res> {
  __$PersonaTodoCopyWithImpl(this._self, this._then);

  final _PersonaTodo _self;
  final $Res Function(_PersonaTodo) _then;

/// Create a copy of PersonaTodo
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? content = null,Object? status = null,}) {
  return _then(_PersonaTodo(
content: null == content ? _self.content : content // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$PersonaPresentedFile {

 String get path; String get title; String get description;
/// Create a copy of PersonaPresentedFile
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PersonaPresentedFileCopyWith<PersonaPresentedFile> get copyWith => _$PersonaPresentedFileCopyWithImpl<PersonaPresentedFile>(this as PersonaPresentedFile, _$identity);

  /// Serializes this PersonaPresentedFile to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PersonaPresentedFile&&(identical(other.path, path) || other.path == path)&&(identical(other.title, title) || other.title == title)&&(identical(other.description, description) || other.description == description));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,path,title,description);

@override
String toString() {
  return 'PersonaPresentedFile(path: $path, title: $title, description: $description)';
}


}

/// @nodoc
abstract mixin class $PersonaPresentedFileCopyWith<$Res>  {
  factory $PersonaPresentedFileCopyWith(PersonaPresentedFile value, $Res Function(PersonaPresentedFile) _then) = _$PersonaPresentedFileCopyWithImpl;
@useResult
$Res call({
 String path, String title, String description
});




}
/// @nodoc
class _$PersonaPresentedFileCopyWithImpl<$Res>
    implements $PersonaPresentedFileCopyWith<$Res> {
  _$PersonaPresentedFileCopyWithImpl(this._self, this._then);

  final PersonaPresentedFile _self;
  final $Res Function(PersonaPresentedFile) _then;

/// Create a copy of PersonaPresentedFile
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? path = null,Object? title = null,Object? description = null,}) {
  return _then(_self.copyWith(
path: null == path ? _self.path : path // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,description: null == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [PersonaPresentedFile].
extension PersonaPresentedFilePatterns on PersonaPresentedFile {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PersonaPresentedFile value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PersonaPresentedFile() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PersonaPresentedFile value)  $default,){
final _that = this;
switch (_that) {
case _PersonaPresentedFile():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PersonaPresentedFile value)?  $default,){
final _that = this;
switch (_that) {
case _PersonaPresentedFile() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String path,  String title,  String description)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PersonaPresentedFile() when $default != null:
return $default(_that.path,_that.title,_that.description);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String path,  String title,  String description)  $default,) {final _that = this;
switch (_that) {
case _PersonaPresentedFile():
return $default(_that.path,_that.title,_that.description);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String path,  String title,  String description)?  $default,) {final _that = this;
switch (_that) {
case _PersonaPresentedFile() when $default != null:
return $default(_that.path,_that.title,_that.description);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PersonaPresentedFile implements PersonaPresentedFile {
  const _PersonaPresentedFile({required this.path, required this.title, required this.description});
  factory _PersonaPresentedFile.fromJson(Map<String, dynamic> json) => _$PersonaPresentedFileFromJson(json);

@override final  String path;
@override final  String title;
@override final  String description;

/// Create a copy of PersonaPresentedFile
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PersonaPresentedFileCopyWith<_PersonaPresentedFile> get copyWith => __$PersonaPresentedFileCopyWithImpl<_PersonaPresentedFile>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PersonaPresentedFileToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PersonaPresentedFile&&(identical(other.path, path) || other.path == path)&&(identical(other.title, title) || other.title == title)&&(identical(other.description, description) || other.description == description));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,path,title,description);

@override
String toString() {
  return 'PersonaPresentedFile(path: $path, title: $title, description: $description)';
}


}

/// @nodoc
abstract mixin class _$PersonaPresentedFileCopyWith<$Res> implements $PersonaPresentedFileCopyWith<$Res> {
  factory _$PersonaPresentedFileCopyWith(_PersonaPresentedFile value, $Res Function(_PersonaPresentedFile) _then) = __$PersonaPresentedFileCopyWithImpl;
@override @useResult
$Res call({
 String path, String title, String description
});




}
/// @nodoc
class __$PersonaPresentedFileCopyWithImpl<$Res>
    implements _$PersonaPresentedFileCopyWith<$Res> {
  __$PersonaPresentedFileCopyWithImpl(this._self, this._then);

  final _PersonaPresentedFile _self;
  final $Res Function(_PersonaPresentedFile) _then;

/// Create a copy of PersonaPresentedFile
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? path = null,Object? title = null,Object? description = null,}) {
  return _then(_PersonaPresentedFile(
path: null == path ? _self.path : path // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,description: null == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}

// dart format on
