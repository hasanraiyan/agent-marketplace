// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'persona_memory.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$PersonaMemoryFile {

 PersonaMemoryScope? get scope; String? get agentId; String get path; String get content; String? get mimeType; String? get createdAt; String? get updatedAt;
/// Create a copy of PersonaMemoryFile
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PersonaMemoryFileCopyWith<PersonaMemoryFile> get copyWith => _$PersonaMemoryFileCopyWithImpl<PersonaMemoryFile>(this as PersonaMemoryFile, _$identity);

  /// Serializes this PersonaMemoryFile to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PersonaMemoryFile&&(identical(other.scope, scope) || other.scope == scope)&&(identical(other.agentId, agentId) || other.agentId == agentId)&&(identical(other.path, path) || other.path == path)&&(identical(other.content, content) || other.content == content)&&(identical(other.mimeType, mimeType) || other.mimeType == mimeType)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,scope,agentId,path,content,mimeType,createdAt,updatedAt);

@override
String toString() {
  return 'PersonaMemoryFile(scope: $scope, agentId: $agentId, path: $path, content: $content, mimeType: $mimeType, createdAt: $createdAt, updatedAt: $updatedAt)';
}


}

/// @nodoc
abstract mixin class $PersonaMemoryFileCopyWith<$Res>  {
  factory $PersonaMemoryFileCopyWith(PersonaMemoryFile value, $Res Function(PersonaMemoryFile) _then) = _$PersonaMemoryFileCopyWithImpl;
@useResult
$Res call({
 PersonaMemoryScope? scope, String? agentId, String path, String content, String? mimeType, String? createdAt, String? updatedAt
});




}
/// @nodoc
class _$PersonaMemoryFileCopyWithImpl<$Res>
    implements $PersonaMemoryFileCopyWith<$Res> {
  _$PersonaMemoryFileCopyWithImpl(this._self, this._then);

  final PersonaMemoryFile _self;
  final $Res Function(PersonaMemoryFile) _then;

/// Create a copy of PersonaMemoryFile
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? scope = freezed,Object? agentId = freezed,Object? path = null,Object? content = null,Object? mimeType = freezed,Object? createdAt = freezed,Object? updatedAt = freezed,}) {
  return _then(_self.copyWith(
scope: freezed == scope ? _self.scope : scope // ignore: cast_nullable_to_non_nullable
as PersonaMemoryScope?,agentId: freezed == agentId ? _self.agentId : agentId // ignore: cast_nullable_to_non_nullable
as String?,path: null == path ? _self.path : path // ignore: cast_nullable_to_non_nullable
as String,content: null == content ? _self.content : content // ignore: cast_nullable_to_non_nullable
as String,mimeType: freezed == mimeType ? _self.mimeType : mimeType // ignore: cast_nullable_to_non_nullable
as String?,createdAt: freezed == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as String?,updatedAt: freezed == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [PersonaMemoryFile].
extension PersonaMemoryFilePatterns on PersonaMemoryFile {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PersonaMemoryFile value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PersonaMemoryFile() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PersonaMemoryFile value)  $default,){
final _that = this;
switch (_that) {
case _PersonaMemoryFile():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PersonaMemoryFile value)?  $default,){
final _that = this;
switch (_that) {
case _PersonaMemoryFile() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( PersonaMemoryScope? scope,  String? agentId,  String path,  String content,  String? mimeType,  String? createdAt,  String? updatedAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PersonaMemoryFile() when $default != null:
return $default(_that.scope,_that.agentId,_that.path,_that.content,_that.mimeType,_that.createdAt,_that.updatedAt);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( PersonaMemoryScope? scope,  String? agentId,  String path,  String content,  String? mimeType,  String? createdAt,  String? updatedAt)  $default,) {final _that = this;
switch (_that) {
case _PersonaMemoryFile():
return $default(_that.scope,_that.agentId,_that.path,_that.content,_that.mimeType,_that.createdAt,_that.updatedAt);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( PersonaMemoryScope? scope,  String? agentId,  String path,  String content,  String? mimeType,  String? createdAt,  String? updatedAt)?  $default,) {final _that = this;
switch (_that) {
case _PersonaMemoryFile() when $default != null:
return $default(_that.scope,_that.agentId,_that.path,_that.content,_that.mimeType,_that.createdAt,_that.updatedAt);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PersonaMemoryFile implements PersonaMemoryFile {
  const _PersonaMemoryFile({this.scope, this.agentId, required this.path, required this.content, this.mimeType, this.createdAt, this.updatedAt});
  factory _PersonaMemoryFile.fromJson(Map<String, dynamic> json) => _$PersonaMemoryFileFromJson(json);

@override final  PersonaMemoryScope? scope;
@override final  String? agentId;
@override final  String path;
@override final  String content;
@override final  String? mimeType;
@override final  String? createdAt;
@override final  String? updatedAt;

/// Create a copy of PersonaMemoryFile
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PersonaMemoryFileCopyWith<_PersonaMemoryFile> get copyWith => __$PersonaMemoryFileCopyWithImpl<_PersonaMemoryFile>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PersonaMemoryFileToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PersonaMemoryFile&&(identical(other.scope, scope) || other.scope == scope)&&(identical(other.agentId, agentId) || other.agentId == agentId)&&(identical(other.path, path) || other.path == path)&&(identical(other.content, content) || other.content == content)&&(identical(other.mimeType, mimeType) || other.mimeType == mimeType)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,scope,agentId,path,content,mimeType,createdAt,updatedAt);

@override
String toString() {
  return 'PersonaMemoryFile(scope: $scope, agentId: $agentId, path: $path, content: $content, mimeType: $mimeType, createdAt: $createdAt, updatedAt: $updatedAt)';
}


}

/// @nodoc
abstract mixin class _$PersonaMemoryFileCopyWith<$Res> implements $PersonaMemoryFileCopyWith<$Res> {
  factory _$PersonaMemoryFileCopyWith(_PersonaMemoryFile value, $Res Function(_PersonaMemoryFile) _then) = __$PersonaMemoryFileCopyWithImpl;
@override @useResult
$Res call({
 PersonaMemoryScope? scope, String? agentId, String path, String content, String? mimeType, String? createdAt, String? updatedAt
});




}
/// @nodoc
class __$PersonaMemoryFileCopyWithImpl<$Res>
    implements _$PersonaMemoryFileCopyWith<$Res> {
  __$PersonaMemoryFileCopyWithImpl(this._self, this._then);

  final _PersonaMemoryFile _self;
  final $Res Function(_PersonaMemoryFile) _then;

/// Create a copy of PersonaMemoryFile
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? scope = freezed,Object? agentId = freezed,Object? path = null,Object? content = null,Object? mimeType = freezed,Object? createdAt = freezed,Object? updatedAt = freezed,}) {
  return _then(_PersonaMemoryFile(
scope: freezed == scope ? _self.scope : scope // ignore: cast_nullable_to_non_nullable
as PersonaMemoryScope?,agentId: freezed == agentId ? _self.agentId : agentId // ignore: cast_nullable_to_non_nullable
as String?,path: null == path ? _self.path : path // ignore: cast_nullable_to_non_nullable
as String,content: null == content ? _self.content : content // ignore: cast_nullable_to_non_nullable
as String,mimeType: freezed == mimeType ? _self.mimeType : mimeType // ignore: cast_nullable_to_non_nullable
as String?,createdAt: freezed == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as String?,updatedAt: freezed == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$PersonaMemoryAgentGroup {

 String get agentId; String? get agentName; List<PersonaMemoryFile> get files;
/// Create a copy of PersonaMemoryAgentGroup
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PersonaMemoryAgentGroupCopyWith<PersonaMemoryAgentGroup> get copyWith => _$PersonaMemoryAgentGroupCopyWithImpl<PersonaMemoryAgentGroup>(this as PersonaMemoryAgentGroup, _$identity);

  /// Serializes this PersonaMemoryAgentGroup to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PersonaMemoryAgentGroup&&(identical(other.agentId, agentId) || other.agentId == agentId)&&(identical(other.agentName, agentName) || other.agentName == agentName)&&const DeepCollectionEquality().equals(other.files, files));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,agentId,agentName,const DeepCollectionEquality().hash(files));

@override
String toString() {
  return 'PersonaMemoryAgentGroup(agentId: $agentId, agentName: $agentName, files: $files)';
}


}

/// @nodoc
abstract mixin class $PersonaMemoryAgentGroupCopyWith<$Res>  {
  factory $PersonaMemoryAgentGroupCopyWith(PersonaMemoryAgentGroup value, $Res Function(PersonaMemoryAgentGroup) _then) = _$PersonaMemoryAgentGroupCopyWithImpl;
@useResult
$Res call({
 String agentId, String? agentName, List<PersonaMemoryFile> files
});




}
/// @nodoc
class _$PersonaMemoryAgentGroupCopyWithImpl<$Res>
    implements $PersonaMemoryAgentGroupCopyWith<$Res> {
  _$PersonaMemoryAgentGroupCopyWithImpl(this._self, this._then);

  final PersonaMemoryAgentGroup _self;
  final $Res Function(PersonaMemoryAgentGroup) _then;

/// Create a copy of PersonaMemoryAgentGroup
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? agentId = null,Object? agentName = freezed,Object? files = null,}) {
  return _then(_self.copyWith(
agentId: null == agentId ? _self.agentId : agentId // ignore: cast_nullable_to_non_nullable
as String,agentName: freezed == agentName ? _self.agentName : agentName // ignore: cast_nullable_to_non_nullable
as String?,files: null == files ? _self.files : files // ignore: cast_nullable_to_non_nullable
as List<PersonaMemoryFile>,
  ));
}

}


/// Adds pattern-matching-related methods to [PersonaMemoryAgentGroup].
extension PersonaMemoryAgentGroupPatterns on PersonaMemoryAgentGroup {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PersonaMemoryAgentGroup value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PersonaMemoryAgentGroup() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PersonaMemoryAgentGroup value)  $default,){
final _that = this;
switch (_that) {
case _PersonaMemoryAgentGroup():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PersonaMemoryAgentGroup value)?  $default,){
final _that = this;
switch (_that) {
case _PersonaMemoryAgentGroup() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String agentId,  String? agentName,  List<PersonaMemoryFile> files)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PersonaMemoryAgentGroup() when $default != null:
return $default(_that.agentId,_that.agentName,_that.files);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String agentId,  String? agentName,  List<PersonaMemoryFile> files)  $default,) {final _that = this;
switch (_that) {
case _PersonaMemoryAgentGroup():
return $default(_that.agentId,_that.agentName,_that.files);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String agentId,  String? agentName,  List<PersonaMemoryFile> files)?  $default,) {final _that = this;
switch (_that) {
case _PersonaMemoryAgentGroup() when $default != null:
return $default(_that.agentId,_that.agentName,_that.files);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PersonaMemoryAgentGroup implements PersonaMemoryAgentGroup {
  const _PersonaMemoryAgentGroup({required this.agentId, this.agentName, required final  List<PersonaMemoryFile> files}): _files = files;
  factory _PersonaMemoryAgentGroup.fromJson(Map<String, dynamic> json) => _$PersonaMemoryAgentGroupFromJson(json);

@override final  String agentId;
@override final  String? agentName;
 final  List<PersonaMemoryFile> _files;
@override List<PersonaMemoryFile> get files {
  if (_files is EqualUnmodifiableListView) return _files;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_files);
}


/// Create a copy of PersonaMemoryAgentGroup
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PersonaMemoryAgentGroupCopyWith<_PersonaMemoryAgentGroup> get copyWith => __$PersonaMemoryAgentGroupCopyWithImpl<_PersonaMemoryAgentGroup>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PersonaMemoryAgentGroupToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PersonaMemoryAgentGroup&&(identical(other.agentId, agentId) || other.agentId == agentId)&&(identical(other.agentName, agentName) || other.agentName == agentName)&&const DeepCollectionEquality().equals(other._files, _files));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,agentId,agentName,const DeepCollectionEquality().hash(_files));

@override
String toString() {
  return 'PersonaMemoryAgentGroup(agentId: $agentId, agentName: $agentName, files: $files)';
}


}

/// @nodoc
abstract mixin class _$PersonaMemoryAgentGroupCopyWith<$Res> implements $PersonaMemoryAgentGroupCopyWith<$Res> {
  factory _$PersonaMemoryAgentGroupCopyWith(_PersonaMemoryAgentGroup value, $Res Function(_PersonaMemoryAgentGroup) _then) = __$PersonaMemoryAgentGroupCopyWithImpl;
@override @useResult
$Res call({
 String agentId, String? agentName, List<PersonaMemoryFile> files
});




}
/// @nodoc
class __$PersonaMemoryAgentGroupCopyWithImpl<$Res>
    implements _$PersonaMemoryAgentGroupCopyWith<$Res> {
  __$PersonaMemoryAgentGroupCopyWithImpl(this._self, this._then);

  final _PersonaMemoryAgentGroup _self;
  final $Res Function(_PersonaMemoryAgentGroup) _then;

/// Create a copy of PersonaMemoryAgentGroup
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? agentId = null,Object? agentName = freezed,Object? files = null,}) {
  return _then(_PersonaMemoryAgentGroup(
agentId: null == agentId ? _self.agentId : agentId // ignore: cast_nullable_to_non_nullable
as String,agentName: freezed == agentName ? _self.agentName : agentName // ignore: cast_nullable_to_non_nullable
as String?,files: null == files ? _self._files : files // ignore: cast_nullable_to_non_nullable
as List<PersonaMemoryFile>,
  ));
}


}


/// @nodoc
mixin _$PersonaMemoryList {

 List<PersonaMemoryFile> get userFiles; List<PersonaMemoryAgentGroup> get agentMemories;
/// Create a copy of PersonaMemoryList
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PersonaMemoryListCopyWith<PersonaMemoryList> get copyWith => _$PersonaMemoryListCopyWithImpl<PersonaMemoryList>(this as PersonaMemoryList, _$identity);

  /// Serializes this PersonaMemoryList to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PersonaMemoryList&&const DeepCollectionEquality().equals(other.userFiles, userFiles)&&const DeepCollectionEquality().equals(other.agentMemories, agentMemories));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(userFiles),const DeepCollectionEquality().hash(agentMemories));

@override
String toString() {
  return 'PersonaMemoryList(userFiles: $userFiles, agentMemories: $agentMemories)';
}


}

/// @nodoc
abstract mixin class $PersonaMemoryListCopyWith<$Res>  {
  factory $PersonaMemoryListCopyWith(PersonaMemoryList value, $Res Function(PersonaMemoryList) _then) = _$PersonaMemoryListCopyWithImpl;
@useResult
$Res call({
 List<PersonaMemoryFile> userFiles, List<PersonaMemoryAgentGroup> agentMemories
});




}
/// @nodoc
class _$PersonaMemoryListCopyWithImpl<$Res>
    implements $PersonaMemoryListCopyWith<$Res> {
  _$PersonaMemoryListCopyWithImpl(this._self, this._then);

  final PersonaMemoryList _self;
  final $Res Function(PersonaMemoryList) _then;

/// Create a copy of PersonaMemoryList
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? userFiles = null,Object? agentMemories = null,}) {
  return _then(_self.copyWith(
userFiles: null == userFiles ? _self.userFiles : userFiles // ignore: cast_nullable_to_non_nullable
as List<PersonaMemoryFile>,agentMemories: null == agentMemories ? _self.agentMemories : agentMemories // ignore: cast_nullable_to_non_nullable
as List<PersonaMemoryAgentGroup>,
  ));
}

}


/// Adds pattern-matching-related methods to [PersonaMemoryList].
extension PersonaMemoryListPatterns on PersonaMemoryList {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PersonaMemoryList value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PersonaMemoryList() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PersonaMemoryList value)  $default,){
final _that = this;
switch (_that) {
case _PersonaMemoryList():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PersonaMemoryList value)?  $default,){
final _that = this;
switch (_that) {
case _PersonaMemoryList() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( List<PersonaMemoryFile> userFiles,  List<PersonaMemoryAgentGroup> agentMemories)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PersonaMemoryList() when $default != null:
return $default(_that.userFiles,_that.agentMemories);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( List<PersonaMemoryFile> userFiles,  List<PersonaMemoryAgentGroup> agentMemories)  $default,) {final _that = this;
switch (_that) {
case _PersonaMemoryList():
return $default(_that.userFiles,_that.agentMemories);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( List<PersonaMemoryFile> userFiles,  List<PersonaMemoryAgentGroup> agentMemories)?  $default,) {final _that = this;
switch (_that) {
case _PersonaMemoryList() when $default != null:
return $default(_that.userFiles,_that.agentMemories);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PersonaMemoryList implements PersonaMemoryList {
  const _PersonaMemoryList({required final  List<PersonaMemoryFile> userFiles, required final  List<PersonaMemoryAgentGroup> agentMemories}): _userFiles = userFiles,_agentMemories = agentMemories;
  factory _PersonaMemoryList.fromJson(Map<String, dynamic> json) => _$PersonaMemoryListFromJson(json);

 final  List<PersonaMemoryFile> _userFiles;
@override List<PersonaMemoryFile> get userFiles {
  if (_userFiles is EqualUnmodifiableListView) return _userFiles;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_userFiles);
}

 final  List<PersonaMemoryAgentGroup> _agentMemories;
@override List<PersonaMemoryAgentGroup> get agentMemories {
  if (_agentMemories is EqualUnmodifiableListView) return _agentMemories;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_agentMemories);
}


/// Create a copy of PersonaMemoryList
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PersonaMemoryListCopyWith<_PersonaMemoryList> get copyWith => __$PersonaMemoryListCopyWithImpl<_PersonaMemoryList>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PersonaMemoryListToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PersonaMemoryList&&const DeepCollectionEquality().equals(other._userFiles, _userFiles)&&const DeepCollectionEquality().equals(other._agentMemories, _agentMemories));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(_userFiles),const DeepCollectionEquality().hash(_agentMemories));

@override
String toString() {
  return 'PersonaMemoryList(userFiles: $userFiles, agentMemories: $agentMemories)';
}


}

/// @nodoc
abstract mixin class _$PersonaMemoryListCopyWith<$Res> implements $PersonaMemoryListCopyWith<$Res> {
  factory _$PersonaMemoryListCopyWith(_PersonaMemoryList value, $Res Function(_PersonaMemoryList) _then) = __$PersonaMemoryListCopyWithImpl;
@override @useResult
$Res call({
 List<PersonaMemoryFile> userFiles, List<PersonaMemoryAgentGroup> agentMemories
});




}
/// @nodoc
class __$PersonaMemoryListCopyWithImpl<$Res>
    implements _$PersonaMemoryListCopyWith<$Res> {
  __$PersonaMemoryListCopyWithImpl(this._self, this._then);

  final _PersonaMemoryList _self;
  final $Res Function(_PersonaMemoryList) _then;

/// Create a copy of PersonaMemoryList
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? userFiles = null,Object? agentMemories = null,}) {
  return _then(_PersonaMemoryList(
userFiles: null == userFiles ? _self._userFiles : userFiles // ignore: cast_nullable_to_non_nullable
as List<PersonaMemoryFile>,agentMemories: null == agentMemories ? _self._agentMemories : agentMemories // ignore: cast_nullable_to_non_nullable
as List<PersonaMemoryAgentGroup>,
  ));
}


}

// dart format on
