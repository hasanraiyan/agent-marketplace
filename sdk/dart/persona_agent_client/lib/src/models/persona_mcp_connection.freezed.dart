// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'persona_mcp_connection.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$PersonaMcpConnection {

 String get mcpId; String get name; String get description; bool get connected; String? get authorizeUrl;
/// Create a copy of PersonaMcpConnection
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PersonaMcpConnectionCopyWith<PersonaMcpConnection> get copyWith => _$PersonaMcpConnectionCopyWithImpl<PersonaMcpConnection>(this as PersonaMcpConnection, _$identity);

  /// Serializes this PersonaMcpConnection to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PersonaMcpConnection&&(identical(other.mcpId, mcpId) || other.mcpId == mcpId)&&(identical(other.name, name) || other.name == name)&&(identical(other.description, description) || other.description == description)&&(identical(other.connected, connected) || other.connected == connected)&&(identical(other.authorizeUrl, authorizeUrl) || other.authorizeUrl == authorizeUrl));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,mcpId,name,description,connected,authorizeUrl);

@override
String toString() {
  return 'PersonaMcpConnection(mcpId: $mcpId, name: $name, description: $description, connected: $connected, authorizeUrl: $authorizeUrl)';
}


}

/// @nodoc
abstract mixin class $PersonaMcpConnectionCopyWith<$Res>  {
  factory $PersonaMcpConnectionCopyWith(PersonaMcpConnection value, $Res Function(PersonaMcpConnection) _then) = _$PersonaMcpConnectionCopyWithImpl;
@useResult
$Res call({
 String mcpId, String name, String description, bool connected, String? authorizeUrl
});




}
/// @nodoc
class _$PersonaMcpConnectionCopyWithImpl<$Res>
    implements $PersonaMcpConnectionCopyWith<$Res> {
  _$PersonaMcpConnectionCopyWithImpl(this._self, this._then);

  final PersonaMcpConnection _self;
  final $Res Function(PersonaMcpConnection) _then;

/// Create a copy of PersonaMcpConnection
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? mcpId = null,Object? name = null,Object? description = null,Object? connected = null,Object? authorizeUrl = freezed,}) {
  return _then(_self.copyWith(
mcpId: null == mcpId ? _self.mcpId : mcpId // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,description: null == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String,connected: null == connected ? _self.connected : connected // ignore: cast_nullable_to_non_nullable
as bool,authorizeUrl: freezed == authorizeUrl ? _self.authorizeUrl : authorizeUrl // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [PersonaMcpConnection].
extension PersonaMcpConnectionPatterns on PersonaMcpConnection {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PersonaMcpConnection value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PersonaMcpConnection() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PersonaMcpConnection value)  $default,){
final _that = this;
switch (_that) {
case _PersonaMcpConnection():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PersonaMcpConnection value)?  $default,){
final _that = this;
switch (_that) {
case _PersonaMcpConnection() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String mcpId,  String name,  String description,  bool connected,  String? authorizeUrl)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PersonaMcpConnection() when $default != null:
return $default(_that.mcpId,_that.name,_that.description,_that.connected,_that.authorizeUrl);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String mcpId,  String name,  String description,  bool connected,  String? authorizeUrl)  $default,) {final _that = this;
switch (_that) {
case _PersonaMcpConnection():
return $default(_that.mcpId,_that.name,_that.description,_that.connected,_that.authorizeUrl);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String mcpId,  String name,  String description,  bool connected,  String? authorizeUrl)?  $default,) {final _that = this;
switch (_that) {
case _PersonaMcpConnection() when $default != null:
return $default(_that.mcpId,_that.name,_that.description,_that.connected,_that.authorizeUrl);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PersonaMcpConnection implements PersonaMcpConnection {
  const _PersonaMcpConnection({required this.mcpId, required this.name, required this.description, required this.connected, this.authorizeUrl});
  factory _PersonaMcpConnection.fromJson(Map<String, dynamic> json) => _$PersonaMcpConnectionFromJson(json);

@override final  String mcpId;
@override final  String name;
@override final  String description;
@override final  bool connected;
@override final  String? authorizeUrl;

/// Create a copy of PersonaMcpConnection
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PersonaMcpConnectionCopyWith<_PersonaMcpConnection> get copyWith => __$PersonaMcpConnectionCopyWithImpl<_PersonaMcpConnection>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PersonaMcpConnectionToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PersonaMcpConnection&&(identical(other.mcpId, mcpId) || other.mcpId == mcpId)&&(identical(other.name, name) || other.name == name)&&(identical(other.description, description) || other.description == description)&&(identical(other.connected, connected) || other.connected == connected)&&(identical(other.authorizeUrl, authorizeUrl) || other.authorizeUrl == authorizeUrl));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,mcpId,name,description,connected,authorizeUrl);

@override
String toString() {
  return 'PersonaMcpConnection(mcpId: $mcpId, name: $name, description: $description, connected: $connected, authorizeUrl: $authorizeUrl)';
}


}

/// @nodoc
abstract mixin class _$PersonaMcpConnectionCopyWith<$Res> implements $PersonaMcpConnectionCopyWith<$Res> {
  factory _$PersonaMcpConnectionCopyWith(_PersonaMcpConnection value, $Res Function(_PersonaMcpConnection) _then) = __$PersonaMcpConnectionCopyWithImpl;
@override @useResult
$Res call({
 String mcpId, String name, String description, bool connected, String? authorizeUrl
});




}
/// @nodoc
class __$PersonaMcpConnectionCopyWithImpl<$Res>
    implements _$PersonaMcpConnectionCopyWith<$Res> {
  __$PersonaMcpConnectionCopyWithImpl(this._self, this._then);

  final _PersonaMcpConnection _self;
  final $Res Function(_PersonaMcpConnection) _then;

/// Create a copy of PersonaMcpConnection
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? mcpId = null,Object? name = null,Object? description = null,Object? connected = null,Object? authorizeUrl = freezed,}) {
  return _then(_PersonaMcpConnection(
mcpId: null == mcpId ? _self.mcpId : mcpId // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,description: null == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String,connected: null == connected ? _self.connected : connected // ignore: cast_nullable_to_non_nullable
as bool,authorizeUrl: freezed == authorizeUrl ? _self.authorizeUrl : authorizeUrl // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}

// dart format on
