// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'persona_chat_state.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;
/// @nodoc
mixin _$PersonaChatState {

 List<PersonaMessage> get messages; String get input; bool get isStreaming; bool get isLoadingHistory; Object? get error; PersonaInterrupt? get interrupt; Map<String, PersonaWorkspaceFile> get files; List<PersonaTodo> get todos; PersonaPresentedFile? get presentedFile;
/// Create a copy of PersonaChatState
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PersonaChatStateCopyWith<PersonaChatState> get copyWith => _$PersonaChatStateCopyWithImpl<PersonaChatState>(this as PersonaChatState, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PersonaChatState&&const DeepCollectionEquality().equals(other.messages, messages)&&(identical(other.input, input) || other.input == input)&&(identical(other.isStreaming, isStreaming) || other.isStreaming == isStreaming)&&(identical(other.isLoadingHistory, isLoadingHistory) || other.isLoadingHistory == isLoadingHistory)&&const DeepCollectionEquality().equals(other.error, error)&&(identical(other.interrupt, interrupt) || other.interrupt == interrupt)&&const DeepCollectionEquality().equals(other.files, files)&&const DeepCollectionEquality().equals(other.todos, todos)&&(identical(other.presentedFile, presentedFile) || other.presentedFile == presentedFile));
}


@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(messages),input,isStreaming,isLoadingHistory,const DeepCollectionEquality().hash(error),interrupt,const DeepCollectionEquality().hash(files),const DeepCollectionEquality().hash(todos),presentedFile);

@override
String toString() {
  return 'PersonaChatState(messages: $messages, input: $input, isStreaming: $isStreaming, isLoadingHistory: $isLoadingHistory, error: $error, interrupt: $interrupt, files: $files, todos: $todos, presentedFile: $presentedFile)';
}


}

/// @nodoc
abstract mixin class $PersonaChatStateCopyWith<$Res>  {
  factory $PersonaChatStateCopyWith(PersonaChatState value, $Res Function(PersonaChatState) _then) = _$PersonaChatStateCopyWithImpl;
@useResult
$Res call({
 List<PersonaMessage> messages, String input, bool isStreaming, bool isLoadingHistory, Object? error, PersonaInterrupt? interrupt, Map<String, PersonaWorkspaceFile> files, List<PersonaTodo> todos, PersonaPresentedFile? presentedFile
});


$PersonaPresentedFileCopyWith<$Res>? get presentedFile;

}
/// @nodoc
class _$PersonaChatStateCopyWithImpl<$Res>
    implements $PersonaChatStateCopyWith<$Res> {
  _$PersonaChatStateCopyWithImpl(this._self, this._then);

  final PersonaChatState _self;
  final $Res Function(PersonaChatState) _then;

/// Create a copy of PersonaChatState
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? messages = null,Object? input = null,Object? isStreaming = null,Object? isLoadingHistory = null,Object? error = freezed,Object? interrupt = freezed,Object? files = null,Object? todos = null,Object? presentedFile = freezed,}) {
  return _then(_self.copyWith(
messages: null == messages ? _self.messages : messages // ignore: cast_nullable_to_non_nullable
as List<PersonaMessage>,input: null == input ? _self.input : input // ignore: cast_nullable_to_non_nullable
as String,isStreaming: null == isStreaming ? _self.isStreaming : isStreaming // ignore: cast_nullable_to_non_nullable
as bool,isLoadingHistory: null == isLoadingHistory ? _self.isLoadingHistory : isLoadingHistory // ignore: cast_nullable_to_non_nullable
as bool,error: freezed == error ? _self.error : error ,interrupt: freezed == interrupt ? _self.interrupt : interrupt // ignore: cast_nullable_to_non_nullable
as PersonaInterrupt?,files: null == files ? _self.files : files // ignore: cast_nullable_to_non_nullable
as Map<String, PersonaWorkspaceFile>,todos: null == todos ? _self.todos : todos // ignore: cast_nullable_to_non_nullable
as List<PersonaTodo>,presentedFile: freezed == presentedFile ? _self.presentedFile : presentedFile // ignore: cast_nullable_to_non_nullable
as PersonaPresentedFile?,
  ));
}
/// Create a copy of PersonaChatState
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PersonaPresentedFileCopyWith<$Res>? get presentedFile {
    if (_self.presentedFile == null) {
    return null;
  }

  return $PersonaPresentedFileCopyWith<$Res>(_self.presentedFile!, (value) {
    return _then(_self.copyWith(presentedFile: value));
  });
}
}


/// Adds pattern-matching-related methods to [PersonaChatState].
extension PersonaChatStatePatterns on PersonaChatState {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PersonaChatState value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PersonaChatState() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PersonaChatState value)  $default,){
final _that = this;
switch (_that) {
case _PersonaChatState():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PersonaChatState value)?  $default,){
final _that = this;
switch (_that) {
case _PersonaChatState() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( List<PersonaMessage> messages,  String input,  bool isStreaming,  bool isLoadingHistory,  Object? error,  PersonaInterrupt? interrupt,  Map<String, PersonaWorkspaceFile> files,  List<PersonaTodo> todos,  PersonaPresentedFile? presentedFile)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PersonaChatState() when $default != null:
return $default(_that.messages,_that.input,_that.isStreaming,_that.isLoadingHistory,_that.error,_that.interrupt,_that.files,_that.todos,_that.presentedFile);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( List<PersonaMessage> messages,  String input,  bool isStreaming,  bool isLoadingHistory,  Object? error,  PersonaInterrupt? interrupt,  Map<String, PersonaWorkspaceFile> files,  List<PersonaTodo> todos,  PersonaPresentedFile? presentedFile)  $default,) {final _that = this;
switch (_that) {
case _PersonaChatState():
return $default(_that.messages,_that.input,_that.isStreaming,_that.isLoadingHistory,_that.error,_that.interrupt,_that.files,_that.todos,_that.presentedFile);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( List<PersonaMessage> messages,  String input,  bool isStreaming,  bool isLoadingHistory,  Object? error,  PersonaInterrupt? interrupt,  Map<String, PersonaWorkspaceFile> files,  List<PersonaTodo> todos,  PersonaPresentedFile? presentedFile)?  $default,) {final _that = this;
switch (_that) {
case _PersonaChatState() when $default != null:
return $default(_that.messages,_that.input,_that.isStreaming,_that.isLoadingHistory,_that.error,_that.interrupt,_that.files,_that.todos,_that.presentedFile);case _:
  return null;

}
}

}

/// @nodoc


class _PersonaChatState extends PersonaChatState {
  const _PersonaChatState({final  List<PersonaMessage> messages = const [], this.input = '', this.isStreaming = false, this.isLoadingHistory = false, this.error, this.interrupt, final  Map<String, PersonaWorkspaceFile> files = const {}, final  List<PersonaTodo> todos = const [], this.presentedFile}): _messages = messages,_files = files,_todos = todos,super._();
  

 final  List<PersonaMessage> _messages;
@override@JsonKey() List<PersonaMessage> get messages {
  if (_messages is EqualUnmodifiableListView) return _messages;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_messages);
}

@override@JsonKey() final  String input;
@override@JsonKey() final  bool isStreaming;
@override@JsonKey() final  bool isLoadingHistory;
@override final  Object? error;
@override final  PersonaInterrupt? interrupt;
 final  Map<String, PersonaWorkspaceFile> _files;
@override@JsonKey() Map<String, PersonaWorkspaceFile> get files {
  if (_files is EqualUnmodifiableMapView) return _files;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableMapView(_files);
}

 final  List<PersonaTodo> _todos;
@override@JsonKey() List<PersonaTodo> get todos {
  if (_todos is EqualUnmodifiableListView) return _todos;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_todos);
}

@override final  PersonaPresentedFile? presentedFile;

/// Create a copy of PersonaChatState
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PersonaChatStateCopyWith<_PersonaChatState> get copyWith => __$PersonaChatStateCopyWithImpl<_PersonaChatState>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PersonaChatState&&const DeepCollectionEquality().equals(other._messages, _messages)&&(identical(other.input, input) || other.input == input)&&(identical(other.isStreaming, isStreaming) || other.isStreaming == isStreaming)&&(identical(other.isLoadingHistory, isLoadingHistory) || other.isLoadingHistory == isLoadingHistory)&&const DeepCollectionEquality().equals(other.error, error)&&(identical(other.interrupt, interrupt) || other.interrupt == interrupt)&&const DeepCollectionEquality().equals(other._files, _files)&&const DeepCollectionEquality().equals(other._todos, _todos)&&(identical(other.presentedFile, presentedFile) || other.presentedFile == presentedFile));
}


@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(_messages),input,isStreaming,isLoadingHistory,const DeepCollectionEquality().hash(error),interrupt,const DeepCollectionEquality().hash(_files),const DeepCollectionEquality().hash(_todos),presentedFile);

@override
String toString() {
  return 'PersonaChatState(messages: $messages, input: $input, isStreaming: $isStreaming, isLoadingHistory: $isLoadingHistory, error: $error, interrupt: $interrupt, files: $files, todos: $todos, presentedFile: $presentedFile)';
}


}

/// @nodoc
abstract mixin class _$PersonaChatStateCopyWith<$Res> implements $PersonaChatStateCopyWith<$Res> {
  factory _$PersonaChatStateCopyWith(_PersonaChatState value, $Res Function(_PersonaChatState) _then) = __$PersonaChatStateCopyWithImpl;
@override @useResult
$Res call({
 List<PersonaMessage> messages, String input, bool isStreaming, bool isLoadingHistory, Object? error, PersonaInterrupt? interrupt, Map<String, PersonaWorkspaceFile> files, List<PersonaTodo> todos, PersonaPresentedFile? presentedFile
});


@override $PersonaPresentedFileCopyWith<$Res>? get presentedFile;

}
/// @nodoc
class __$PersonaChatStateCopyWithImpl<$Res>
    implements _$PersonaChatStateCopyWith<$Res> {
  __$PersonaChatStateCopyWithImpl(this._self, this._then);

  final _PersonaChatState _self;
  final $Res Function(_PersonaChatState) _then;

/// Create a copy of PersonaChatState
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? messages = null,Object? input = null,Object? isStreaming = null,Object? isLoadingHistory = null,Object? error = freezed,Object? interrupt = freezed,Object? files = null,Object? todos = null,Object? presentedFile = freezed,}) {
  return _then(_PersonaChatState(
messages: null == messages ? _self._messages : messages // ignore: cast_nullable_to_non_nullable
as List<PersonaMessage>,input: null == input ? _self.input : input // ignore: cast_nullable_to_non_nullable
as String,isStreaming: null == isStreaming ? _self.isStreaming : isStreaming // ignore: cast_nullable_to_non_nullable
as bool,isLoadingHistory: null == isLoadingHistory ? _self.isLoadingHistory : isLoadingHistory // ignore: cast_nullable_to_non_nullable
as bool,error: freezed == error ? _self.error : error ,interrupt: freezed == interrupt ? _self.interrupt : interrupt // ignore: cast_nullable_to_non_nullable
as PersonaInterrupt?,files: null == files ? _self._files : files // ignore: cast_nullable_to_non_nullable
as Map<String, PersonaWorkspaceFile>,todos: null == todos ? _self._todos : todos // ignore: cast_nullable_to_non_nullable
as List<PersonaTodo>,presentedFile: freezed == presentedFile ? _self.presentedFile : presentedFile // ignore: cast_nullable_to_non_nullable
as PersonaPresentedFile?,
  ));
}

/// Create a copy of PersonaChatState
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PersonaPresentedFileCopyWith<$Res>? get presentedFile {
    if (_self.presentedFile == null) {
    return null;
  }

  return $PersonaPresentedFileCopyWith<$Res>(_self.presentedFile!, (value) {
    return _then(_self.copyWith(presentedFile: value));
  });
}
}

// dart format on
