// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'persona_tool_call.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$PersonaSubagentActivityEntry {

 PersonaSubagentActivityKind get kind; String? get toolName; String? get args; String? get result; String? get delta;
/// Create a copy of PersonaSubagentActivityEntry
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PersonaSubagentActivityEntryCopyWith<PersonaSubagentActivityEntry> get copyWith => _$PersonaSubagentActivityEntryCopyWithImpl<PersonaSubagentActivityEntry>(this as PersonaSubagentActivityEntry, _$identity);

  /// Serializes this PersonaSubagentActivityEntry to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PersonaSubagentActivityEntry&&(identical(other.kind, kind) || other.kind == kind)&&(identical(other.toolName, toolName) || other.toolName == toolName)&&(identical(other.args, args) || other.args == args)&&(identical(other.result, result) || other.result == result)&&(identical(other.delta, delta) || other.delta == delta));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,kind,toolName,args,result,delta);

@override
String toString() {
  return 'PersonaSubagentActivityEntry(kind: $kind, toolName: $toolName, args: $args, result: $result, delta: $delta)';
}


}

/// @nodoc
abstract mixin class $PersonaSubagentActivityEntryCopyWith<$Res>  {
  factory $PersonaSubagentActivityEntryCopyWith(PersonaSubagentActivityEntry value, $Res Function(PersonaSubagentActivityEntry) _then) = _$PersonaSubagentActivityEntryCopyWithImpl;
@useResult
$Res call({
 PersonaSubagentActivityKind kind, String? toolName, String? args, String? result, String? delta
});




}
/// @nodoc
class _$PersonaSubagentActivityEntryCopyWithImpl<$Res>
    implements $PersonaSubagentActivityEntryCopyWith<$Res> {
  _$PersonaSubagentActivityEntryCopyWithImpl(this._self, this._then);

  final PersonaSubagentActivityEntry _self;
  final $Res Function(PersonaSubagentActivityEntry) _then;

/// Create a copy of PersonaSubagentActivityEntry
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? kind = null,Object? toolName = freezed,Object? args = freezed,Object? result = freezed,Object? delta = freezed,}) {
  return _then(_self.copyWith(
kind: null == kind ? _self.kind : kind // ignore: cast_nullable_to_non_nullable
as PersonaSubagentActivityKind,toolName: freezed == toolName ? _self.toolName : toolName // ignore: cast_nullable_to_non_nullable
as String?,args: freezed == args ? _self.args : args // ignore: cast_nullable_to_non_nullable
as String?,result: freezed == result ? _self.result : result // ignore: cast_nullable_to_non_nullable
as String?,delta: freezed == delta ? _self.delta : delta // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [PersonaSubagentActivityEntry].
extension PersonaSubagentActivityEntryPatterns on PersonaSubagentActivityEntry {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PersonaSubagentActivityEntry value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PersonaSubagentActivityEntry() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PersonaSubagentActivityEntry value)  $default,){
final _that = this;
switch (_that) {
case _PersonaSubagentActivityEntry():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PersonaSubagentActivityEntry value)?  $default,){
final _that = this;
switch (_that) {
case _PersonaSubagentActivityEntry() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( PersonaSubagentActivityKind kind,  String? toolName,  String? args,  String? result,  String? delta)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PersonaSubagentActivityEntry() when $default != null:
return $default(_that.kind,_that.toolName,_that.args,_that.result,_that.delta);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( PersonaSubagentActivityKind kind,  String? toolName,  String? args,  String? result,  String? delta)  $default,) {final _that = this;
switch (_that) {
case _PersonaSubagentActivityEntry():
return $default(_that.kind,_that.toolName,_that.args,_that.result,_that.delta);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( PersonaSubagentActivityKind kind,  String? toolName,  String? args,  String? result,  String? delta)?  $default,) {final _that = this;
switch (_that) {
case _PersonaSubagentActivityEntry() when $default != null:
return $default(_that.kind,_that.toolName,_that.args,_that.result,_that.delta);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PersonaSubagentActivityEntry implements PersonaSubagentActivityEntry {
  const _PersonaSubagentActivityEntry({required this.kind, this.toolName, this.args, this.result, this.delta});
  factory _PersonaSubagentActivityEntry.fromJson(Map<String, dynamic> json) => _$PersonaSubagentActivityEntryFromJson(json);

@override final  PersonaSubagentActivityKind kind;
@override final  String? toolName;
@override final  String? args;
@override final  String? result;
@override final  String? delta;

/// Create a copy of PersonaSubagentActivityEntry
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PersonaSubagentActivityEntryCopyWith<_PersonaSubagentActivityEntry> get copyWith => __$PersonaSubagentActivityEntryCopyWithImpl<_PersonaSubagentActivityEntry>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PersonaSubagentActivityEntryToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PersonaSubagentActivityEntry&&(identical(other.kind, kind) || other.kind == kind)&&(identical(other.toolName, toolName) || other.toolName == toolName)&&(identical(other.args, args) || other.args == args)&&(identical(other.result, result) || other.result == result)&&(identical(other.delta, delta) || other.delta == delta));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,kind,toolName,args,result,delta);

@override
String toString() {
  return 'PersonaSubagentActivityEntry(kind: $kind, toolName: $toolName, args: $args, result: $result, delta: $delta)';
}


}

/// @nodoc
abstract mixin class _$PersonaSubagentActivityEntryCopyWith<$Res> implements $PersonaSubagentActivityEntryCopyWith<$Res> {
  factory _$PersonaSubagentActivityEntryCopyWith(_PersonaSubagentActivityEntry value, $Res Function(_PersonaSubagentActivityEntry) _then) = __$PersonaSubagentActivityEntryCopyWithImpl;
@override @useResult
$Res call({
 PersonaSubagentActivityKind kind, String? toolName, String? args, String? result, String? delta
});




}
/// @nodoc
class __$PersonaSubagentActivityEntryCopyWithImpl<$Res>
    implements _$PersonaSubagentActivityEntryCopyWith<$Res> {
  __$PersonaSubagentActivityEntryCopyWithImpl(this._self, this._then);

  final _PersonaSubagentActivityEntry _self;
  final $Res Function(_PersonaSubagentActivityEntry) _then;

/// Create a copy of PersonaSubagentActivityEntry
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? kind = null,Object? toolName = freezed,Object? args = freezed,Object? result = freezed,Object? delta = freezed,}) {
  return _then(_PersonaSubagentActivityEntry(
kind: null == kind ? _self.kind : kind // ignore: cast_nullable_to_non_nullable
as PersonaSubagentActivityKind,toolName: freezed == toolName ? _self.toolName : toolName // ignore: cast_nullable_to_non_nullable
as String?,args: freezed == args ? _self.args : args // ignore: cast_nullable_to_non_nullable
as String?,result: freezed == result ? _self.result : result // ignore: cast_nullable_to_non_nullable
as String?,delta: freezed == delta ? _self.delta : delta // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$PersonaToolCall {

 String get toolCallId; String get toolName; String? get args; String? get result; bool get isError;/// Nested activity timeline — only present on `task` (subagent) tool calls.
 List<PersonaSubagentActivityEntry>? get subagentActivity;
/// Create a copy of PersonaToolCall
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PersonaToolCallCopyWith<PersonaToolCall> get copyWith => _$PersonaToolCallCopyWithImpl<PersonaToolCall>(this as PersonaToolCall, _$identity);

  /// Serializes this PersonaToolCall to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PersonaToolCall&&(identical(other.toolCallId, toolCallId) || other.toolCallId == toolCallId)&&(identical(other.toolName, toolName) || other.toolName == toolName)&&(identical(other.args, args) || other.args == args)&&(identical(other.result, result) || other.result == result)&&(identical(other.isError, isError) || other.isError == isError)&&const DeepCollectionEquality().equals(other.subagentActivity, subagentActivity));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,toolCallId,toolName,args,result,isError,const DeepCollectionEquality().hash(subagentActivity));

@override
String toString() {
  return 'PersonaToolCall(toolCallId: $toolCallId, toolName: $toolName, args: $args, result: $result, isError: $isError, subagentActivity: $subagentActivity)';
}


}

/// @nodoc
abstract mixin class $PersonaToolCallCopyWith<$Res>  {
  factory $PersonaToolCallCopyWith(PersonaToolCall value, $Res Function(PersonaToolCall) _then) = _$PersonaToolCallCopyWithImpl;
@useResult
$Res call({
 String toolCallId, String toolName, String? args, String? result, bool isError, List<PersonaSubagentActivityEntry>? subagentActivity
});




}
/// @nodoc
class _$PersonaToolCallCopyWithImpl<$Res>
    implements $PersonaToolCallCopyWith<$Res> {
  _$PersonaToolCallCopyWithImpl(this._self, this._then);

  final PersonaToolCall _self;
  final $Res Function(PersonaToolCall) _then;

/// Create a copy of PersonaToolCall
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? toolCallId = null,Object? toolName = null,Object? args = freezed,Object? result = freezed,Object? isError = null,Object? subagentActivity = freezed,}) {
  return _then(_self.copyWith(
toolCallId: null == toolCallId ? _self.toolCallId : toolCallId // ignore: cast_nullable_to_non_nullable
as String,toolName: null == toolName ? _self.toolName : toolName // ignore: cast_nullable_to_non_nullable
as String,args: freezed == args ? _self.args : args // ignore: cast_nullable_to_non_nullable
as String?,result: freezed == result ? _self.result : result // ignore: cast_nullable_to_non_nullable
as String?,isError: null == isError ? _self.isError : isError // ignore: cast_nullable_to_non_nullable
as bool,subagentActivity: freezed == subagentActivity ? _self.subagentActivity : subagentActivity // ignore: cast_nullable_to_non_nullable
as List<PersonaSubagentActivityEntry>?,
  ));
}

}


/// Adds pattern-matching-related methods to [PersonaToolCall].
extension PersonaToolCallPatterns on PersonaToolCall {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PersonaToolCall value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PersonaToolCall() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PersonaToolCall value)  $default,){
final _that = this;
switch (_that) {
case _PersonaToolCall():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PersonaToolCall value)?  $default,){
final _that = this;
switch (_that) {
case _PersonaToolCall() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String toolCallId,  String toolName,  String? args,  String? result,  bool isError,  List<PersonaSubagentActivityEntry>? subagentActivity)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PersonaToolCall() when $default != null:
return $default(_that.toolCallId,_that.toolName,_that.args,_that.result,_that.isError,_that.subagentActivity);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String toolCallId,  String toolName,  String? args,  String? result,  bool isError,  List<PersonaSubagentActivityEntry>? subagentActivity)  $default,) {final _that = this;
switch (_that) {
case _PersonaToolCall():
return $default(_that.toolCallId,_that.toolName,_that.args,_that.result,_that.isError,_that.subagentActivity);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String toolCallId,  String toolName,  String? args,  String? result,  bool isError,  List<PersonaSubagentActivityEntry>? subagentActivity)?  $default,) {final _that = this;
switch (_that) {
case _PersonaToolCall() when $default != null:
return $default(_that.toolCallId,_that.toolName,_that.args,_that.result,_that.isError,_that.subagentActivity);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PersonaToolCall implements PersonaToolCall {
  const _PersonaToolCall({required this.toolCallId, required this.toolName, this.args, this.result, this.isError = false, final  List<PersonaSubagentActivityEntry>? subagentActivity}): _subagentActivity = subagentActivity;
  factory _PersonaToolCall.fromJson(Map<String, dynamic> json) => _$PersonaToolCallFromJson(json);

@override final  String toolCallId;
@override final  String toolName;
@override final  String? args;
@override final  String? result;
@override@JsonKey() final  bool isError;
/// Nested activity timeline — only present on `task` (subagent) tool calls.
 final  List<PersonaSubagentActivityEntry>? _subagentActivity;
/// Nested activity timeline — only present on `task` (subagent) tool calls.
@override List<PersonaSubagentActivityEntry>? get subagentActivity {
  final value = _subagentActivity;
  if (value == null) return null;
  if (_subagentActivity is EqualUnmodifiableListView) return _subagentActivity;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(value);
}


/// Create a copy of PersonaToolCall
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PersonaToolCallCopyWith<_PersonaToolCall> get copyWith => __$PersonaToolCallCopyWithImpl<_PersonaToolCall>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PersonaToolCallToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PersonaToolCall&&(identical(other.toolCallId, toolCallId) || other.toolCallId == toolCallId)&&(identical(other.toolName, toolName) || other.toolName == toolName)&&(identical(other.args, args) || other.args == args)&&(identical(other.result, result) || other.result == result)&&(identical(other.isError, isError) || other.isError == isError)&&const DeepCollectionEquality().equals(other._subagentActivity, _subagentActivity));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,toolCallId,toolName,args,result,isError,const DeepCollectionEquality().hash(_subagentActivity));

@override
String toString() {
  return 'PersonaToolCall(toolCallId: $toolCallId, toolName: $toolName, args: $args, result: $result, isError: $isError, subagentActivity: $subagentActivity)';
}


}

/// @nodoc
abstract mixin class _$PersonaToolCallCopyWith<$Res> implements $PersonaToolCallCopyWith<$Res> {
  factory _$PersonaToolCallCopyWith(_PersonaToolCall value, $Res Function(_PersonaToolCall) _then) = __$PersonaToolCallCopyWithImpl;
@override @useResult
$Res call({
 String toolCallId, String toolName, String? args, String? result, bool isError, List<PersonaSubagentActivityEntry>? subagentActivity
});




}
/// @nodoc
class __$PersonaToolCallCopyWithImpl<$Res>
    implements _$PersonaToolCallCopyWith<$Res> {
  __$PersonaToolCallCopyWithImpl(this._self, this._then);

  final _PersonaToolCall _self;
  final $Res Function(_PersonaToolCall) _then;

/// Create a copy of PersonaToolCall
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? toolCallId = null,Object? toolName = null,Object? args = freezed,Object? result = freezed,Object? isError = null,Object? subagentActivity = freezed,}) {
  return _then(_PersonaToolCall(
toolCallId: null == toolCallId ? _self.toolCallId : toolCallId // ignore: cast_nullable_to_non_nullable
as String,toolName: null == toolName ? _self.toolName : toolName // ignore: cast_nullable_to_non_nullable
as String,args: freezed == args ? _self.args : args // ignore: cast_nullable_to_non_nullable
as String?,result: freezed == result ? _self.result : result // ignore: cast_nullable_to_non_nullable
as String?,isError: null == isError ? _self.isError : isError // ignore: cast_nullable_to_non_nullable
as bool,subagentActivity: freezed == subagentActivity ? _self._subagentActivity : subagentActivity // ignore: cast_nullable_to_non_nullable
as List<PersonaSubagentActivityEntry>?,
  ));
}


}

// dart format on
