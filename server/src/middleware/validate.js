import Joi from 'joi';
import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError.js';

export const objectId = () =>
  Joi.string().custom((value, helpers) =>
    mongoose.isValidObjectId(value) ? value : helpers.message('must be a valid id')
  );

/**
 * validate({ body, query, params }) — validates and replaces each part with the sanitised value.
 */
export const validate = (schemas) => (req, _res, next) => {
  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue;
    const { value, error } = schemas[part].validate(req[part] ?? {}, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });
    if (error) {
      const details = error.details.map((d) => ({ field: d.path.join('.'), message: d.message.replace(/"/g, '') }));
      return next(ApiError.badRequest('Validation failed', details));
    }
    if (part === 'query') {
      // req.query is a getter in Express 5-ready code paths; assign keys instead of replacing
      Object.keys(req.query).forEach((k) => delete req.query[k]);
      Object.assign(req.query, value);
    } else {
      req[part] = value;
    }
  }
  next();
};

export const idParam = { params: Joi.object({ id: objectId().required() }) };
