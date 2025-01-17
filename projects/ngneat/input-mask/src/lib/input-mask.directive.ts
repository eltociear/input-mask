import { isPlatformServer } from '@angular/common';
import {
  AfterViewInit,
  Directive,
  ElementRef,
  HostListener,
  Inject,
  Input,
  OnDestroy,
  OnInit,
  Optional,
  PLATFORM_ID,
  Renderer2,
  Self,
} from '@angular/core';
import { ControlValueAccessor, NgControl, Validator } from '@angular/forms';
import Inputmask from 'inputmask';
import { InputMaskConfig, INPUT_MASK_CONFIG } from './config';
import { InputmaskOptions } from './types';

@Directive({ selector: '[inputMask]' })
export class InputMaskDirective<T = any>
  implements OnInit, AfterViewInit, OnDestroy, ControlValueAccessor, Validator {
  /**
   *Helps you to create input-mask based on https://github.com/RobinHerbots/Inputmask
   *Supports form-validation out-of-the box.
   *Visit https://github.com/ngneat/input-mask for more info.
   */
  @Input() inputMask: InputmaskOptions<T> = {};
  inputMaskPlugin: Inputmask.Instance | undefined;
  nativeInputElement: HTMLInputElement | undefined;
  defaultInputMaskConfig = new InputMaskConfig();
  private mutationObserver: MutationObserver | undefined;

  constructor(
    @Inject(PLATFORM_ID) private platformId: string,
    private elementRef: ElementRef<HTMLInputElement | any>,
    private renderer: Renderer2,
    @Optional() @Self() public ngControl: NgControl,
    @Inject(INPUT_MASK_CONFIG) config: InputMaskConfig
  ) {
    if (this.ngControl != null) {
      this.ngControl.valueAccessor = this;
    }
    if (this.elementRef.nativeElement.tagName === 'INPUT') {
      this.nativeInputElement = this.elementRef.nativeElement;
    } else {
      this.defaultInputMaskConfig = {
        ...this.defaultInputMaskConfig,
        ...config,
      };
      if (this.defaultInputMaskConfig.isAsync) {
        // Create an observer instance linked to the callback function
        this.mutationObserver = new MutationObserver((mutationsList) => {
          for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
              const nativeInputElement = this.elementRef.nativeElement.querySelector(
                this.defaultInputMaskConfig.inputSelector
              );
              if (nativeInputElement) {
                this.nativeInputElement = nativeInputElement;
                this.mutationObserver?.disconnect();
                this.initInputMask();
              }
            }
          }
        });

        // Start observing the target node for configured mutations
        this.mutationObserver.observe(this.elementRef.nativeElement, {
          childList: true,
          subtree: true,
        });
      } else {
        this.nativeInputElement = this.elementRef.nativeElement.querySelector(
          this.defaultInputMaskConfig.inputSelector
        );
      }
    }
  }

  @HostListener('input', ['$event.target.value'])
  onInput = (_: any) => {};

  ngOnInit() {
    this.ngControl?.control?.setValidators([this.validate.bind(this)]);
    this.ngControl?.control?.updateValueAndValidity();
  }

  ngOnDestroy(): void {
    this.inputMaskPlugin?.remove();
    this.mutationObserver?.disconnect();
  }

  initInputMask() {
    if (this.nativeInputElement) {
      if (isPlatformServer(this.platformId)) {
        return;
      }

      if (Object.keys(this.inputMask).length) {
        this.inputMaskPlugin = new Inputmask(this.inputMaskOptions).mask(
          this.nativeInputElement as HTMLInputElement
        );
        setTimeout(() => {
          this.ngControl?.control?.updateValueAndValidity();
        });
      }
    }
  }

  ngAfterViewInit() {
    this.initInputMask();
  }

  get inputMaskOptions(): Inputmask.Options {
    const { parser, ...options } = this.inputMask;
    return options;
  }

  writeValue(value: string): void {
    if (this.nativeInputElement) {
      this.renderer.setProperty(this.nativeInputElement, 'value', value ?? '');
    }
  }

  registerOnChange(fn: (_: T | null) => void): void {
    const parser = this.inputMask.parser;
    this.onInput = (value) => {
      fn(parser ? parser(value) : value);
    };
  }

  registerOnTouched(fn: any): void {}

  validate(): { [key: string]: any } | null {
    const isEmptyValue = !this.nativeInputElement?.value.length;
    return isEmptyValue ||
      (this.inputMaskPlugin && this.inputMaskPlugin.isValid())
      ? null
      : { inputMask: true };
  }
}
