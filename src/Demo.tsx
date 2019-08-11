import React from "react";
import { observer } from "mobx-react";
import { FieldState, FormState } from "formstate";
import uuid from "uuid";
import { action, computed } from "mobx";

const PERCENTAGE: "percentage" = "percentage";
const MONETARY: "monetary" = "monetary";
type CardType = "percentage" | "monetary";

class MyFieldState<T> extends FieldState<T> {
  constructor(initValue: T) {
    super(initValue);
    this.disableAutoValidation();
  }

  // Get rid of 200ms debounce
  queueValidation = action(this.queuedValidationWakeup);
}

class NumberField extends FieldState<number> {
  onStrChange(value: string): void {
    const parsedNum = parseFloat(value);
    if (value.length === 0 || !isNaN(parsedNum)) {
      this.onChange(parsedNum);
    }
  }
}

type MonetaryBliStateType = {
  amounts: FormState<NumberField[]>;
};

class MonetaryBliState extends FormState<MonetaryBliStateType> {
  bliType: "monetary" = MONETARY;
  private static makeMonetaryFieldState() {
    return new NumberField(0);
  }

  constructor() {
    super({
      amounts: new FormState([MonetaryBliState.makeMonetaryFieldState()])
    });
  }

  @computed get total() {
    return this.$.amounts.$.reduce(
        (accum, monetaryField) => accum + monetaryField.$,
        0
    );
  }
}

type PercentageBliStateType = {
  total: NumberField;
  percentages: FormState<Array<NumberField>>;
};

class PercentageBliState extends FormState<PercentageBliStateType> {
  bliType: "percentage" = PERCENTAGE;
  private static makePercentageFieldState() {
    return new NumberField(0).validators(val => {
      if (val == undefined) {
        return "Percentage is required";
      }
    });
  }

  constructor() {
    super({
      total: new NumberField(0),
      percentages: new FormState([
        PercentageBliState.makePercentageFieldState()
      ])
    });
    this.validators(val => {
      let totalPercentage = val.percentages.$.reduce(
        (accum, thisField) => accum + thisField.$,
        0
      );
      if (totalPercentage !== 100) {
        return "All percentage must sum to 100";
      }
    });
  }
}

class DemoState {
  private makeCard() {
    const dropdownState = new MyFieldState<CardType>("monetary");

    //TODOO: use in render
    const bliForm: PercentageBliState | MonetaryBliState = (() => {
      switch (dropdownState.$) {
        case "monetary":
          return new MonetaryBliState();
        case "percentage": {
          return new PercentageBliState();
        }
      }
    })();

    return new FormState({
      id: new MyFieldState(uuid.v4()),
      username: new MyFieldState("").validators(
        val => !val && "username required",
        val => val !== "blah" && "bad name"
      ),
      dropdown: dropdownState,
      bli: bliForm
    });
  }

  // Compose fields into a form
  form = new FormState([this.makeCard()]);

  addCard = () => this.form.$.push(this.makeCard());

  onSubmit = async (e: any) => {
    e.preventDefault();
    //  Validate all fields
    const res = await this.form.validate();
    // If any errors you would know
    if (res.hasError) {
      console.log(this.form.error);
      return;
    }
  };
}

@observer
export class Demo extends React.Component<{}, {}> {
  data = new DemoState();

  render() {
    const data = this.data;
    return (
      <form onSubmit={data.onSubmit}>
        {this.renderCards()}
        <button type="button" onClick={data.addCard}>
          Add
        </button>
        <button type="submit">Submit</button>
      </form>
    );
  }

  renderCards = () => {
    const cardData = this.data.form.$;
    const cards = cardData.map(c => {
      return (
        <div className="card" key={c.$.id.$}>
          <input
            type="text"
            value={c.$.username.value}
            onChange={e => {
              const val = e.target.value;
              if (val.length === 0 || !isNaN(parseInt(val))) {
                c.$.username.onChange(e.target.value);
              }
            }}
          />
          <select
            value={c.$.dropdown.value}
            onChange={e => {
              return c.$.dropdown.onChange(e.target.value as CardType);
            }}
          >
            <option value="monetary">Monetary</option>
            <option value="percentage">Percentage</option>
          </select>
          {this.renderBli(c.$.bli)}
          <p>{c.$.username.error}</p>
        </div>
      );
    });

    return <>{cards}</>;
  };

  renderBli = (bli: PercentageBliState | MonetaryBliState) => {
    switch (bli.bliType) {
      case PERCENTAGE:
        return (
          <>
            Total:
            <input
              type="text"
              value={bli.$.total.$}
              onChange={e => bli.$.total.onStrChange(e.target.value)}
            />
            {bli.$.percentages.$.map(percentField => {
              return (
                <input
                  type="text"
                  value={percentField.value}
                  onChange={e => percentField.onStrChange(e.target.value)}
                />
              );
            })}
          </>
        );
      case MONETARY:
        return (
          <>
            {bli.$.amounts.$.map(monetaryField => {
              return (
                <>
                  Monetary value:
                  <input
                    type="text"
                    value={monetaryField.value}
                    onChange={e => monetaryField.onStrChange(e.target.value)}
                  />
                </>
              );
            })}
          </>
        );
    }
  };
}
