import '../models/models.dart';

typedef PersonaOnFinish = void Function(PersonaMessage message);
typedef PersonaOnError = void Function(Object error);
typedef PersonaOnEvent = void Function(PersonaStreamingEvent event);
