import 'failures.dart';

/// Union class representing either a success ([AppSuccess]) carrying data [T],
/// or a failure ([AppFailure]) carrying a [Failure].
sealed class AppResult<T> {
  const AppResult();

  R when<R>({
    required R Function(T data) success,
    required R Function(Failure failure) failure,
  }) {
    return switch (this) {
      AppSuccess<T>(:final data) => success(data),
      AppFailure<T>(failure: final error) => failure(error),
    };
  }

  T? get dataOrNull {
    return switch (this) {
      AppSuccess<T>(:final data) => data,
      AppFailure<T>() => null,
    };
  }

  Failure? get failureOrNull {
    return switch (this) {
      AppSuccess<T>() => null,
      AppFailure<T>(failure: final error) => error,
    };
  }
}

class AppSuccess<T> extends AppResult<T> {
  const AppSuccess(this.data);

  final T data;
}

class AppFailure<T> extends AppResult<T> {
  const AppFailure(this.failure);

  final Failure failure;
}
