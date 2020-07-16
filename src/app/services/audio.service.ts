import { Injectable, ElementRef, TestabilityRegistry } from '@angular/core';
import { BehaviorSubject, forkJoin } from 'rxjs';
import { PlayerState, IMPLUSE_RESPONSES } from '../models';
import { HttpClient, HttpResponse } from '@angular/common/http';

@Injectable()
export class AudioService {

    public audioContext: AudioContext;
    public audioSource: AudioBufferSourceNode;
    public audioGainNode: GainNode;
    public analyserNode: AnalyserNode;
    public pannerNode: PannerNode;
    public stereoPannerNode: StereoPannerNode;
    public convolver: ConvolverNode;
    public biquadFilter: BiquadFilterNode;
    private _loopEnabled: boolean;
    
    private canvas: HTMLCanvasElement;
    private canvasContext: CanvasRenderingContext2D;
    private animationFrameRequest: number;
    private dataArray: Uint8Array;
    private impluseResponseAudioBuffers: AudioBuffer[] = [];
    
    public originalAudioBuffer: AudioBuffer;
    public isLoading$: BehaviorSubject<boolean>;
    public playerStatChanged$: BehaviorSubject<PlayerState>;
    
    public get shouldLoopAudio(): boolean {
        return this._loopEnabled;
    }
    
    public set shouldLoopAudio(value: boolean) {
        if (this.audioContext) {
            this.audioSource.loop = value;
        }
        this._loopEnabled = value;
    }
    
    constructor(private httpClient: HttpClient) { 
        this.audioContext = new (window.AudioContext || window['webkitAudioContext'])();
        this.audioGainNode = this.audioContext.createGain();
        this.analyserNode = this.audioContext.createAnalyser();
        this.audioSource = this.audioContext.createBufferSource();
        this.biquadFilter = this.audioContext.createBiquadFilter();
        this.pannerNode = this.audioContext.createPanner();
        this.stereoPannerNode = this.audioContext.createStereoPanner();
        this.convolver = this.audioContext.createConvolver();
        
        this.audioSource
            .connect(this.biquadFilter)
            .connect(this.stereoPannerNode)
            .connect(this.pannerNode)
            .connect(this.convolver)
            .connect(this.analyserNode)
            .connect(this.audioGainNode)
            .connect(this.audioContext.destination);
        
        this.dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
        this.isLoading$ = new BehaviorSubject(false);
        this.playerStatChanged$ = new BehaviorSubject(PlayerState.STOPPED);
        this.shouldLoopAudio = true;
    }

    public async loadUrl(url: string) {
        this.isLoading$.next(true);
        this.httpClient.get(url,  {
            responseType: 'arraybuffer',
            observe: 'body'
        }).subscribe(async (arraybuffer) => {
            this.originalAudioBuffer = await this.audioContext.decodeAudioData(arraybuffer);
            this.audioSource.buffer = this.originalAudioBuffer;
            this.isLoading$.next(false);
            await this.loadImpluseResponseFiles();
        }, (error) => {
            console.log(error);
            this.isLoading$.next(false);
        });
    }
    
    public async loadFile(file: File) {
        try {
            console.log('Recieved file', file);
            let fileReader = new FileReader();
            fileReader.addEventListener('loadend', async () => {
                try {
                    let audioBuffer = fileReader.result as ArrayBuffer;
                    this.originalAudioBuffer = await this.audioContext.decodeAudioData(audioBuffer);
                    this.audioSource.buffer = this.originalAudioBuffer;
                    this.isLoading$.next(false);
                    await this.loadImpluseResponseFiles();
                } catch (error) {
                    console.error(error);
                }
            });
            fileReader.readAsArrayBuffer(file);
            this.isLoading$.next(true);
        } catch(error) {
            console.error(error);
            this.isLoading$.next(false);
        }
    }
    
    public refreshAudioSource() {
        if (this.audioSource) {
            this.audioSource.disconnect();
            this.audioSource = null;
        }
        this.audioSource = this.audioContext.createBufferSource();
        this.audioSource.connect(this.audioGainNode).connect(this.analyserNode).connect(this.audioContext.destination);
        this.audioSource.buffer = this.originalAudioBuffer;
    }
    
    public setVolume(value: number) {
        if (value === null ||  isNaN(value)) {
            console.warn('Cannot set volume: Not a number');
            return;
        }
        this.audioGainNode.gain.value = this.normalize(0, 1, value);
    }

    public setFilterType(value: BiquadFilterType) {
        this.biquadFilter.type = value;
    }

    public setFilterQuality(value: number) {
        this.biquadFilter.Q.value = value;
    }
    
    public play() {
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
            this.playerStatChanged$.next(PlayerState.PLAYING);
        } else {
            this.audioSource.start();
            this.playerStatChanged$.next(PlayerState.PLAYING);
        } 
    }
    
    public pause() {
        if (this.audioContext.state === 'running') {
            this.audioContext.suspend();
            this.playerStatChanged$.next(PlayerState.PAUSED);
        }
    }
    
    public stop() {
        if (this.audioContext.state === 'running') {
            this.audioContext.suspend();
            this.playerStatChanged$.next(PlayerState.STOPPED);
        }
    }
    
    public togglePlayState() {
        if (this.audioSource) {
            switch(this.playerStatChanged$.value) {
                case PlayerState.PLAYING:
                this.pause();
                break;
                default:
                this.play();
            }
        }
    }

    public setStereoPannerValue(value: number) {
        let normalizedValue = this.normalize(-1, 1, value);
        this.stereoPannerNode.pan.value = normalizedValue;
    }
    
    public normalize(min: number, max: number, value: number) {
        return Math.max(Math.min(value, max), min);
    }
    
    public setCanvasForOscillioscope(canvasElement: HTMLCanvasElement) {
        this.canvas = canvasElement;
        this.canvasContext = this.canvas.getContext('2d');
        this.startOscilloscope();
    }

    public startOscilloscope() {
        if (this.canvas && this.canvasContext) {
            this.drawWaveform();
        } else {
            console.warn('Cannot draw waveform: Canvas not initialized');
        }
    }

    public stopOscilloscope() {
        window.cancelAnimationFrame(this.animationFrameRequest);
    }
    
    private drawWaveform = () => {
        this.animationFrameRequest = window.requestAnimationFrame(this.drawWaveform);
        this.analyserNode.getByteTimeDomainData(this.dataArray);
        
        this.canvasContext.fillStyle = "rgb(0, 0, 0)";
        this.canvasContext.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.canvasContext.lineWidth = 2;
        this.canvasContext.strokeStyle = "rgb(0, 225, 0)";
        
        this.canvasContext.beginPath();
        
        let sliceWidth = this.canvas.width * 1.0 / this.dataArray.length;
        let x = 0;
        
        for (let i = 0; i < this.dataArray.length; i++) {
            
            let v = this.dataArray[i] / 128.0;
            let y = v * this.canvas.height / 2;
            
            if (i === 0) {
                this.canvasContext.moveTo(x, y);
            } else {
                this.canvasContext.lineTo(x, y);
            }
            
            x += sliceWidth;
        }
        this.canvasContext.lineTo(this.canvas.width, this.canvas.height / 2);
        this.canvasContext.stroke();
    }

    public setImpulseResponse(value: string) {
        let index = IMPLUSE_RESPONSES.findIndex(e => e.name === value);
        if (index < 0) {
            console.warn('Cannot load impulse response: Invalid name');
            this.convolver.buffer = null;
            //this.convolver.disconnect()
        } else {
            this.convolver.buffer = this.impluseResponseAudioBuffers[index];
            //this.convolver.connect(this.pannerNode);
        }
    }

    public async loadImpluseResponseFiles() {
        this.isLoading$.next(true);
        const fileRequests = IMPLUSE_RESPONSES.map(i => i.filePath).map(x => this.httpClient.get(x, {
            responseType: 'arraybuffer',
            observe: 'body',
        }));
        forkJoin(fileRequests).subscribe(async data => {
            data.forEach( async (arrayBuffer) => {
                this.impluseResponseAudioBuffers.push(await this.audioContext.decodeAudioData(arrayBuffer));
            });
            this.isLoading$.next(false);
        }, (error) => {
            console.error(error);
        });
    }
}
