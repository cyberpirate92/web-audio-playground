import { Component, ViewChild, ElementRef } from '@angular/core';
import { SAMPLE_AUDIO } from './models';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss']
})
export class AppComponent {

    public title: string = 'Hello, world!';
    public audioFileUrl: string;
    public SAMPLE_AUDIO = SAMPLE_AUDIO;
    public url: string;

    public urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;

    @ViewChild('audioInput', { static: true }) audioInputRef: ElementRef<HTMLInputElement>;

    public onUploadAction(): void {
        this.audioInputRef.nativeElement.click();
    }

    public onFileInput(event: InputEvent) {
        console.log('File selected', event);
        if (this.audioInputRef.nativeElement.files.length > 0) {
            this.audioFileUrl = window.URL.createObjectURL(this.audioInputRef.nativeElement.files.item(0));
            console.log('Set Audio file Url', this.audioFileUrl);
        } else {
            console.warn('NO FILE SELECTED');
        }
    }

    public loadSample(url: string) {
        if (url) {
            this.audioFileUrl = url;
            console.log('Set Audio file Url', url);
        }
    }
}
