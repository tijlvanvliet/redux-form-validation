import basicValidations from './basic-validations.js'
import isPromise from 'is-promise';
var validationStore = {};

export function addValidation(key, fn) {
    validationStore[key] = fn;
}

export function addMultipleValidations(obj) {
    Object.keys(obj).forEach((key)=> addValidation(key, obj[key]))
}

addMultipleValidations(basicValidations);


export function generateAsyncValidation(validationConfig) {
    return (values, dispatch) => {
        var promiseList = [Promise.resolve()];
        var errors = {};

        function addError(field, validatorName, message = true, error) {
            if (!error[field]) {
                error[field] = {};
            }
            error[field][validatorName] = message;

        }

        function addHasError(fieldName, validation, validationType, value, error) {
            var hasError = validationStore[validationType](fieldName, value, validation[validationType], dispatch, values, validation);
            if (isPromise(hasError)) {
                promiseList.push(new Promise((resolve, reject)=> {
                    hasError.then(resolve).catch((msg) => {
                        console.log('promise has error', msg);
                        addError(fieldName, validationType, msg, error);
                        resolve();
                    })
                }))
            } else if (hasError) {
                addError(fieldName, validationType, hasError, error);
            }
        }

        function checkField(fieldName, validation, error) {
          if (typeof validation === 'object') {
              Object.keys(validation).map((validationType) => {
                  if(fieldName.includes('.') && (typeof validationStore[validationType] === 'function')) {
                    const names = fieldName.split('.');
                    const parent = names[0];
                    if (!error[parent]) {
                        error[parent] = {};
                    }
                    names.shift();
                    const name = names.join('.');
                    addHasError(name, validation, validationType, values[parent][name], error[parent]);
                  }
                  else if((typeof validationStore[validationType] === 'function')) {
                    addHasError(fieldName, validation, validationType, values[fieldName], error);
                  } /* else if(typeof validation[validationType] === 'object') {
                    Object.keys(validation).map((fieldnameChild) => {
                      //if((typeof validationStore[validationType] != 'function')) {
                        if (!error[fieldName]) {
                            error[fieldName] = {};
                        }
                        checkField(fieldnameChild, validation[fieldnameChild], error[fieldName]);
                      //}
                    });

                  }*/ else {
                    return;
                  }
              })
          }
        }

        Object.keys(validationConfig).map((fieldName) => {
            var validation = validationConfig[fieldName];
            checkField(fieldName,validation, errors);
        });
        return Promise.all(promiseList).then(()=> {
            if (Object.keys(errors).length) {
                return Promise.reject(errors);
            }
        });
    }
}

export function generateAsyncBlurFields(validationConfig) {
    return Object.keys(validationConfig).filter((fieldName) => {
        return typeof(validationConfig[fieldName]) === 'object' && validationConfig[fieldName].validateOnBlur
    })
}

export function generateValidation(validationConfig) {
    return {
        asyncValidate: generateAsyncValidation(validationConfig),
        asyncBlurFields: generateAsyncBlurFields(validationConfig),
        fields: Object.keys(validationConfig)
    }
}
