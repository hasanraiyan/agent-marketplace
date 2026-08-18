// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'persona_interrupt.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$PersonaHitlActionRequest {

 String get name; Object? get args;
/// Create a copy of PersonaHitlActionRequest
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PersonaHitlActionRequestCopyWith<PersonaHitlActionRequest> get copyWith => _$PersonaHitlActionRequestCopyWithImpl<PersonaHitlActionRequest>(this as PersonaHitlActionRequest, _$identity);

  /// Serializes this PersonaHitlActionRequest to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PersonaHitlActionRequest&&(identical(other.name, name) || other.name == name)&&const DeepCollectionEquality().equals(other.args, args));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,name,const DeepCollectionEquality().hash(args));

@override
String toString() {
  return 'PersonaHitlActionRequest(name: $name, args: $args)';
}


}

/// @nodoc
abstract mixin class $PersonaHitlActionRequestCopyWith<$Res>  {
  factory $PersonaHitlActionRequestCopyWith(PersonaHitlActionRequest value, $Res Function(PersonaHitlActionRequest) _then) = _$PersonaHitlActionRequestCopyWithImpl;
@useResult
$Res call({
 String name, Object? args
});




}
/// @nodoc
class _$PersonaHitlActionRequestCopyWithImpl<$Res>
    implements $PersonaHitlActionRequestCopyWith<$Res> {
  _$PersonaHitlActionRequestCopyWithImpl(this._self, this._then);

  final PersonaHitlActionRequest _self;
  final $Res Function(PersonaHitlActionRequest) _then;

/// Create a copy of PersonaHitlActionRequest
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? name = null,Object? args = freezed,}) {
  return _then(_self.copyWith(
name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,args: freezed == args ? _self.args : args ,
  ));
}

}


/// Adds pattern-matching-related methods to [PersonaHitlActionRequest].
extension PersonaHitlActionRequestPatterns on PersonaHitlActionRequest {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PersonaHitlActionRequest value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PersonaHitlActionRequest() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PersonaHitlActionRequest value)  $default,){
final _that = this;
switch (_that) {
case _PersonaHitlActionRequest():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PersonaHitlActionRequest value)?  $default,){
final _that = this;
switch (_that) {
case _PersonaHitlActionRequest() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String name,  Object? args)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PersonaHitlActionRequest() when $default != null:
return $default(_that.name,_that.args);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String name,  Object? args)  $default,) {final _that = this;
switch (_that) {
case _PersonaHitlActionRequest():
return $default(_that.name,_that.args);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String name,  Object? args)?  $default,) {final _that = this;
switch (_that) {
case _PersonaHitlActionRequest() when $default != null:
return $default(_that.name,_that.args);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PersonaHitlActionRequest implements PersonaHitlActionRequest {
  const _PersonaHitlActionRequest({required this.name, this.args});
  factory _PersonaHitlActionRequest.fromJson(Map<String, dynamic> json) => _$PersonaHitlActionRequestFromJson(json);

@override final  String name;
@override final  Object? args;

/// Create a copy of PersonaHitlActionRequest
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PersonaHitlActionRequestCopyWith<_PersonaHitlActionRequest> get copyWith => __$PersonaHitlActionRequestCopyWithImpl<_PersonaHitlActionRequest>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PersonaHitlActionRequestToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PersonaHitlActionRequest&&(identical(other.name, name) || other.name == name)&&const DeepCollectionEquality().equals(other.args, args));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,name,const DeepCollectionEquality().hash(args));

@override
String toString() {
  return 'PersonaHitlActionRequest(name: $name, args: $args)';
}


}

/// @nodoc
abstract mixin class _$PersonaHitlActionRequestCopyWith<$Res> implements $PersonaHitlActionRequestCopyWith<$Res> {
  factory _$PersonaHitlActionRequestCopyWith(_PersonaHitlActionRequest value, $Res Function(_PersonaHitlActionRequest) _then) = __$PersonaHitlActionRequestCopyWithImpl;
@override @useResult
$Res call({
 String name, Object? args
});




}
/// @nodoc
class __$PersonaHitlActionRequestCopyWithImpl<$Res>
    implements _$PersonaHitlActionRequestCopyWith<$Res> {
  __$PersonaHitlActionRequestCopyWithImpl(this._self, this._then);

  final _PersonaHitlActionRequest _self;
  final $Res Function(_PersonaHitlActionRequest) _then;

/// Create a copy of PersonaHitlActionRequest
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? name = null,Object? args = freezed,}) {
  return _then(_PersonaHitlActionRequest(
name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,args: freezed == args ? _self.args : args ,
  ));
}


}


/// @nodoc
mixin _$PersonaClarificationQuestion {

 String get id; String get text; List<String> get options; bool get required; bool get allowCustom;
/// Create a copy of PersonaClarificationQuestion
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PersonaClarificationQuestionCopyWith<PersonaClarificationQuestion> get copyWith => _$PersonaClarificationQuestionCopyWithImpl<PersonaClarificationQuestion>(this as PersonaClarificationQuestion, _$identity);

  /// Serializes this PersonaClarificationQuestion to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PersonaClarificationQuestion&&(identical(other.id, id) || other.id == id)&&(identical(other.text, text) || other.text == text)&&const DeepCollectionEquality().equals(other.options, options)&&(identical(other.required, required) || other.required == required)&&(identical(other.allowCustom, allowCustom) || other.allowCustom == allowCustom));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,text,const DeepCollectionEquality().hash(options),required,allowCustom);

@override
String toString() {
  return 'PersonaClarificationQuestion(id: $id, text: $text, options: $options, required: $required, allowCustom: $allowCustom)';
}


}

/// @nodoc
abstract mixin class $PersonaClarificationQuestionCopyWith<$Res>  {
  factory $PersonaClarificationQuestionCopyWith(PersonaClarificationQuestion value, $Res Function(PersonaClarificationQuestion) _then) = _$PersonaClarificationQuestionCopyWithImpl;
@useResult
$Res call({
 String id, String text, List<String> options, bool required, bool allowCustom
});




}
/// @nodoc
class _$PersonaClarificationQuestionCopyWithImpl<$Res>
    implements $PersonaClarificationQuestionCopyWith<$Res> {
  _$PersonaClarificationQuestionCopyWithImpl(this._self, this._then);

  final PersonaClarificationQuestion _self;
  final $Res Function(PersonaClarificationQuestion) _then;

/// Create a copy of PersonaClarificationQuestion
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? text = null,Object? options = null,Object? required = null,Object? allowCustom = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,text: null == text ? _self.text : text // ignore: cast_nullable_to_non_nullable
as String,options: null == options ? _self.options : options // ignore: cast_nullable_to_non_nullable
as List<String>,required: null == required ? _self.required : required // ignore: cast_nullable_to_non_nullable
as bool,allowCustom: null == allowCustom ? _self.allowCustom : allowCustom // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [PersonaClarificationQuestion].
extension PersonaClarificationQuestionPatterns on PersonaClarificationQuestion {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PersonaClarificationQuestion value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PersonaClarificationQuestion() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PersonaClarificationQuestion value)  $default,){
final _that = this;
switch (_that) {
case _PersonaClarificationQuestion():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PersonaClarificationQuestion value)?  $default,){
final _that = this;
switch (_that) {
case _PersonaClarificationQuestion() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String text,  List<String> options,  bool required,  bool allowCustom)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PersonaClarificationQuestion() when $default != null:
return $default(_that.id,_that.text,_that.options,_that.required,_that.allowCustom);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String text,  List<String> options,  bool required,  bool allowCustom)  $default,) {final _that = this;
switch (_that) {
case _PersonaClarificationQuestion():
return $default(_that.id,_that.text,_that.options,_that.required,_that.allowCustom);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String text,  List<String> options,  bool required,  bool allowCustom)?  $default,) {final _that = this;
switch (_that) {
case _PersonaClarificationQuestion() when $default != null:
return $default(_that.id,_that.text,_that.options,_that.required,_that.allowCustom);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PersonaClarificationQuestion implements PersonaClarificationQuestion {
  const _PersonaClarificationQuestion({required this.id, required this.text, required final  List<String> options, required this.required, required this.allowCustom}): _options = options;
  factory _PersonaClarificationQuestion.fromJson(Map<String, dynamic> json) => _$PersonaClarificationQuestionFromJson(json);

@override final  String id;
@override final  String text;
 final  List<String> _options;
@override List<String> get options {
  if (_options is EqualUnmodifiableListView) return _options;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_options);
}

@override final  bool required;
@override final  bool allowCustom;

/// Create a copy of PersonaClarificationQuestion
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PersonaClarificationQuestionCopyWith<_PersonaClarificationQuestion> get copyWith => __$PersonaClarificationQuestionCopyWithImpl<_PersonaClarificationQuestion>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PersonaClarificationQuestionToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PersonaClarificationQuestion&&(identical(other.id, id) || other.id == id)&&(identical(other.text, text) || other.text == text)&&const DeepCollectionEquality().equals(other._options, _options)&&(identical(other.required, required) || other.required == required)&&(identical(other.allowCustom, allowCustom) || other.allowCustom == allowCustom));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,text,const DeepCollectionEquality().hash(_options),required,allowCustom);

@override
String toString() {
  return 'PersonaClarificationQuestion(id: $id, text: $text, options: $options, required: $required, allowCustom: $allowCustom)';
}


}

/// @nodoc
abstract mixin class _$PersonaClarificationQuestionCopyWith<$Res> implements $PersonaClarificationQuestionCopyWith<$Res> {
  factory _$PersonaClarificationQuestionCopyWith(_PersonaClarificationQuestion value, $Res Function(_PersonaClarificationQuestion) _then) = __$PersonaClarificationQuestionCopyWithImpl;
@override @useResult
$Res call({
 String id, String text, List<String> options, bool required, bool allowCustom
});




}
/// @nodoc
class __$PersonaClarificationQuestionCopyWithImpl<$Res>
    implements _$PersonaClarificationQuestionCopyWith<$Res> {
  __$PersonaClarificationQuestionCopyWithImpl(this._self, this._then);

  final _PersonaClarificationQuestion _self;
  final $Res Function(_PersonaClarificationQuestion) _then;

/// Create a copy of PersonaClarificationQuestion
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? text = null,Object? options = null,Object? required = null,Object? allowCustom = null,}) {
  return _then(_PersonaClarificationQuestion(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,text: null == text ? _self.text : text // ignore: cast_nullable_to_non_nullable
as String,options: null == options ? _self._options : options // ignore: cast_nullable_to_non_nullable
as List<String>,required: null == required ? _self.required : required // ignore: cast_nullable_to_non_nullable
as bool,allowCustom: null == allowCustom ? _self.allowCustom : allowCustom // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}

// dart format on
