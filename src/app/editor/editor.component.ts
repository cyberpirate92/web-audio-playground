import { Component, OnInit, Input, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { AudioService } from '../services/audio.service';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { PlayerState, IMPLUSE_RESPONSES } from '../models';

@Component({
    selector: 'app-editor',
    templateUrl: './editor.component.html',
    styleUrls: ['./editor.component.scss']
})
export class EditorComponent implements OnInit, OnDestroy {
    
    private destroyed$ = new Subject();
    public isPlaying = false;
    private _volume: number;
    private _filterType: BiquadFilterType;
    private _filterQuality: number;
    private _stereoPan: number;
    private _implulseResponse: string;
    public isLoading: boolean;

    public IMPULSE_RESPONSES = IMPLUSE_RESPONSES;
    
    @Input('audioFileUrl') audioFileUrl: string;
    @ViewChild('waveform', { static: true }) canvas: ElementRef<HTMLCanvasElement>;
    
    public get volume(): number {
        return this._volume;
    }
    
    public set volume(value: number) {
        this._volume = value;
        this.audioService.setVolume(value);
    }

    public get filterType(): BiquadFilterType {
        return this._filterType;
    }

    public set filterType(value: BiquadFilterType) {
        this._filterType = value;
        this.audioService.setFilterType(value);
    }

    public get filterQuality(): number {
        return this._filterQuality;
    }

    public set filterQuality(value: number) {
        this._filterQuality = value;
        this.audioService.setFilterQuality(value);
    }

    public get stereoPan(): number {
        return this._stereoPan;
    }
    
    public set stereoPan(value : number) {
        this._stereoPan = value;
        this.audioService.setStereoPannerValue(value);
    }

    public get impulseResponse(): string {
        return this._implulseResponse;
    }

    public set impulseResponse(value: string) {
        this._implulseResponse = value;
        this.audioService.setImpulseResponse(value);
    }
    
    constructor(public audioService: AudioService) {
        this.volume = 1;
        this.filterType = 'allpass';
        this.impulseResponse = null;
    }
    
    ngOnInit(): void {
        if (this.canvas) {
            this.audioService.setCanvasForOscillioscope(this.canvas.nativeElement);
        }
        this.audioService.playerStatChanged$.pipe(takeUntil(this.destroyed$)).subscribe(state => {
            console.log('Player state changed', state);
            this.isPlaying = state === PlayerState.PLAYING;
        });

        this.audioService.isLoading$.pipe(takeUntil(this.destroyed$)).subscribe(value => this.isLoading = value);
        
        if (this.audioFileUrl) {
            this.audioService.loadUrl(this.audioFileUrl);
        }
    }
    
    ngOnDestroy(): void {
        this.destroyed$.next();
        this.destroyed$.complete();
    }
}
