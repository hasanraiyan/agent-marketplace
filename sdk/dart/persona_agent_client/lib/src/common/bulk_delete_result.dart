/// Result of a bulk-delete call — shared by threads and files, whose
/// `POST .../bulk-delete {ids}` endpoints return the same shape. `failed`
/// entries carry why that one id couldn't be deleted.
class PersonaBulkDeleteResult {
  const PersonaBulkDeleteResult({required this.deleted, required this.failed});

  final List<String> deleted;
  final List<PersonaBulkDeleteFailure> failed;

  factory PersonaBulkDeleteResult.fromJson(Map<String, dynamic> json) => PersonaBulkDeleteResult(
    deleted: (json['deleted'] as List<dynamic>? ?? const []).cast<String>(),
    failed: (json['failed'] as List<dynamic>? ?? const [])
        .map((e) => PersonaBulkDeleteFailure.fromJson(e as Map<String, dynamic>))
        .toList(),
  );
}

class PersonaBulkDeleteFailure {
  const PersonaBulkDeleteFailure({required this.id, required this.reason});

  final String id;
  final String reason;

  factory PersonaBulkDeleteFailure.fromJson(Map<String, dynamic> json) => PersonaBulkDeleteFailure(
    id: json['id'] as String? ?? '',
    reason: json['reason'] as String? ?? '',
  );
}
