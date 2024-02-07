"use strict";

const Joi = require("joi");
const query = require("./queries/query");

export class Validation {
  errors: Record<string, string[]>;

  constructor() {
    this.errors = {};
  }

  fail(): boolean {
    return Object.entries(this.errors).length !== 0;
  }

  async validateUserRegister(data: any) {
    //username: required | email | unique | length < 101
    if (Joi.string().validate(data?.username, { presence: "required" }).error) {
      this.addErrorMessage("username", "The email field is required.");
    } else {
      // Cant do these checks if it is null or empty

      if (Joi.string().email().validate(data?.username).error) {
        this.addErrorMessage("username", "Please provide a valid email.");
      }

      if (Joi.string().max(100).validate(data?.username).error) {
        this.addErrorMessage(
          "username",
          "The email field cannot be longer than 100 characters."
        );
      }

      if (await query.usernameExist(data?.username)) {
        this.addErrorMessage(
          "username",
          "This email has already been registered."
        );
      }
    }

    //password: required | 5 < length < 101
    if (Joi.string().validate(data?.password, { presence: "required" }).error) {
      this.addErrorMessage("password", "The password field is required.");
    } else {
      if (Joi.string().min(6).max(100).validate(data?.password).error) {
        this.addErrorMessage(
          "password",
          "The password has to be between 5 and 100 characters."
        );
      }
    }

    //firstName: required | length < 101
    if (
      Joi.string().validate(data?.firstName, { presence: "required" }).error
    ) {
      this.addErrorMessage("firstName", "The first name field is required.");
    } else {
      // Cant do these checks if it is null or empty
      if (Joi.string().max(100).validate(data?.firstName).error) {
        this.addErrorMessage(
          "firstName",
          "The first name field cannot be longer than 100 characters."
        );
      }
    }

    //lastName: required | length < 101
    if (Joi.string().validate(data?.lastName, { presence: "required" }).error) {
      this.addErrorMessage("lastName", "The last name field is required.");
    } else {
      // Cant do these checks if it is null or empty
      if (Joi.string().max(100).validate(data?.lastName).error) {
        this.addErrorMessage(
          "lastName",
          "The last name field cannot be longer than 100 characters."
        );
      }
    }

    function optionalWithMax(
      validator: Validation,
      data: any,
      key: string,
      max: number,
      label: string
    ) {
      if (data[key] !== null && data[key] !== "") {
        if (Joi.string().max(max).validate(data[key]).error) {
          validator.addErrorMessage(
            key,
            label + " field cannot be longer than " + max + " characters."
          );
        }
      }
    }

    optionalWithMax(this, data, "postcode", 10, "Post code");
    optionalWithMax(this, data, "phone", 20, "Phone");
    optionalWithMax(this, data, "address1", 100, "Address");
    optionalWithMax(this, data, "address2", 100, "Address");
    optionalWithMax(this, data, "organisation", 100, "Organisation");
    optionalWithMax(
      this,
      data,
      "organisationSubType",
      100,
      "Organisation activity"
    );
    optionalWithMax(
      this,
      data,
      "organisationNumber",
      100,
      "Organisation number"
    );
    optionalWithMax(this, data, "organisationType", 100, "Organisation type");

    return this;
  }

  async validateUserDetailUpdate(data: any) {
    //firstName: required | length < 101
    if (
      Joi.string().validate(data?.firstName, { presence: "required" }).error
    ) {
      this.addErrorMessage("firstName", "The first name field is required.");
    } else {
      // Cant do these checks if it is null or empty
      if (Joi.string().max(100).validate(data?.firstName).error) {
        this.addErrorMessage(
          "firstName",
          "The first name field cannot be longer than 100 characters."
        );
      }
    }

    //lastName: required | length < 101
    if (Joi.string().validate(data?.lastName, { presence: "required" }).error) {
      this.addErrorMessage("lastName", "The last name field is required.");
    } else {
      // Cant do these checks if it is null or empty
      if (Joi.string().max(100).validate(data?.lastName).error) {
        this.addErrorMessage(
          "lastName",
          "The last name field cannot be longer than 100 characters."
        );
      }
    }

    let optionalWithMax = function (
      validator: Validation,
      data: any,
      key: string,
      max: number,
      label: string
    ) {
      if (data[key] !== null) {
        if (Joi.string().max(max).validate(data[key]).error) {
          validator.addErrorMessage(
            key,
            label + " field cannot be longer than " + max + " characters."
          );
        }
      }
    };

    optionalWithMax(this, data, "postcode", 10, "Post code");
    optionalWithMax(this, data, "phone", 20, "Phone");
    optionalWithMax(this, data, "address1", 100, "Address");
    optionalWithMax(this, data, "address2", 100, "Address");
    optionalWithMax(this, data, "organisation", 100, "Organisation");
    optionalWithMax(
      this,
      data,
      "organisationSubType",
      100,
      "Organisation activity"
    );
    optionalWithMax(
      this,
      data,
      "organisationNumber",
      100,
      "Organisation number"
    );
    optionalWithMax(this, data, "organisationType", 100, "Organisation type");

    return this;
  }

  async validateChangeEmail(data: any) {
    //username: required | email | unique | length < 101
    if (Joi.string().validate(data?.username, { presence: "required" }).error) {
      this.addErrorMessage("username", "The email field is required.");
    } else {
      // Cant do these checks if it is null or empty

      if (Joi.string().email().validate(data?.username).error) {
        this.addErrorMessage("username", "Please provide a valid email.");
      }

      if (Joi.string().max(100).validate(data?.username).error) {
        this.addErrorMessage(
          "username",
          "The email field cannot be longer than 100 characters."
        );
      }

      if (await query.usernameExist(data?.username)) {
        this.addErrorMessage(
          "username",
          "An account already exists with this email."
        );
      }
    }

    return this;
  }

  async validateChangePassword(data: any) {
    //password: required | 5 < length < 101
    if (Joi.string().validate(data?.password, { presence: "required" }).error) {
      this.addErrorMessage("password", "The password field is required.");
    } else {
      if (Joi.string().min(6).max(100).validate(data?.password).error) {
        this.addErrorMessage(
          "password",
          "The password must be between 5 and 100 characters."
        );
      }
    }

    return this;
  }

  /**
   * @param data
   * @returns
   */
  async validateSaveMap(data: any) {
    //name: required
    if (Joi.string().validate(data?.name, { presence: "required" }).error) {
      this.addErrorMessage("name", "The name field is required.");
    }

    //data: required
    if (Joi.string().validate(data?.data, { presence: "required" }).error) {
      this.addErrorMessage("data", "The data field is required.");
    }

    return this;
  }

  /**
   * Validate eid is provided
   *
   * @param data
   * @returns
   */
  async validateEid(data: any) {
    if (Joi.number().validate(data?.eid, { presence: "required" }).error) {
      this.addErrorMessage("eid", "The eid field is required.");
    }

    return this;
  }

  /**
   * Validate share map request
   *
   * @param data
   * @returns
   */
  async validateShareMap(data: any) {
    // eid required
    this.validateEid(data);

    // array of email address required (can be empty array)
    if (
      Joi.array()
        .items(Joi.string(), Joi.number())
        .validate(data?.emailAddresses).error
    ) {
      this.addErrorMessage(
        "emailAddresses",
        "The emailAddresses field is required."
      );
    }

    return this;
  }

  /**
   * Validate polygon
   *
   * @param data
   * @returns
   */
  async validateLandOwnershipPolygonRequest(data: any) {
    // sw_lng, sw_lat, ne_lng, ne_lat required

    if (Joi.number().validate(data?.sw_lng, { presence: "required" }).error) {
      this.addErrorMessage("sw_lng", "The sw_lng field is required.");
    }
    if (Joi.number().validate(data?.sw_lat, { presence: "required" }).error) {
      this.addErrorMessage("sw_lat", "The sw_lat field is required.");
    }
    if (Joi.number().validate(data?.ne_lng, { presence: "required" }).error) {
      this.addErrorMessage("ne_lng", "The ne_lng field is required.");
    }
    if (Joi.number().validate(data?.ne_lat, { presence: "required" }).error) {
      this.addErrorMessage("ne_lat", "The ne_lat field is required.");
    }

    return this;
  }

  /**
   *
   * @param key
   * @param message
   * @returns
   */
  addErrorMessage(key: string, message: string) {
    if (this.errors.hasOwnProperty(key)) {
      this.errors[key].push(message);
    } else {
      this.errors[key] = [message];
    }

    return this;
  }

  /***  Validate user feedback ***/
  async validateUserFeedback(data: any) {
    // question_1: required
    if (
      Joi.string().validate(data?.question1, { presence: "required" }).error
    ) {
      this.addErrorMessage("question_use_case", "Dance is required.");
    }

    // question_2: required
    if (
      Joi.string().validate(data?.question2, { presence: "required" }).error
    ) {
      this.addErrorMessage("question_impact", "Hats are required.");
    }

    // question_3: required
    if (
      Joi.string().validate(data?.question3, { presence: "required" }).error
    ) {
      this.addErrorMessage("question_who_benefits", "Fun is required.");
    }

    // question_4: required
    if (
      Joi.string().validate(data?.question4, { presence: "required" }).error
    ) {
      this.addErrorMessage("question_improvements", "Pizza is required.");
    }

    return this;
  }
}
