import { Param, ParseUUIDPipe } from '@nestjs/common';
import { notFound } from '../utils/field-error';

/** @IdParam() id: string  ->  reads :id and rejects anything that is not a UUID with a clean 404. */
export const IdParam = () => Param('id', new ParseUUIDPipe({ exceptionFactory: () => notFound('That record') }));
