/// Typed wrapper around any API response.
///
/// Every repository method should return `ApiResponse<T>` so callers
/// always get a consistent structure regardless of success or failure.
class ApiResponse<T> {
  const ApiResponse._({
    required this.data,
    required this.message,
    required this.statusCode,
    required this.success,
  });

  final T? data;
  final String message;
  final int statusCode;
  final bool success;

  // ── Constructors ────────────────────────────────────────────────────────────

  factory ApiResponse.success({
    T? data,
    String message = 'Success',
    int statusCode = 200,
  }) => ApiResponse._(
    data: data,
    message: message,
    statusCode: statusCode,
    success: true,
  );

  factory ApiResponse.failure({
    String message = 'Something went wrong',
    int statusCode = 500,
  }) => ApiResponse._(
    data: null,
    message: message,
    statusCode: statusCode,
    success: false,
  );

  // ── JSON ────────────────────────────────────────────────────────────────────

  factory ApiResponse.fromJson(
    Map<String, dynamic> json,
    T Function(dynamic) fromData,
  ) {
    return ApiResponse._(
      data: json['data'] != null ? fromData(json['data']) : null,
      message: json['message'] as String? ?? '',
      statusCode: (json['statusCode'] ?? json['status_code']) as int? ?? 200,
      success: json['success'] as bool? ?? true,
    );
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /// Returns [data] if present, else calls [orElse].
  T dataOrElse(T Function() orElse) => data ?? orElse();

  @override
  String toString() =>
      'ApiResponse(success: $success, statusCode: $statusCode, message: $message)';
}
