async function mergeAudioFiles(files) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // convert each uploaded file into an AudioBuffer
    const audioBuffers = await Promise.all(
        Array.from(files).map(async (file) => {
            const arrayBuffer = await file.arrayBuffer();
            return await audioContext.decodeAudioData(arrayBuffer);
        })
    );

    // get total duration and necessary properties
    const totalSamples = audioBuffers.reduce((sum, buffer) => sum + buffer.length, 0);
    const sampleRate = audioContext.sampleRate;
    const numberOfChannels = audioBuffers[0].numberOfChannels;

    // create an empty buffer to store merged audio
    const mergedBuffer = audioContext.createBuffer(numberOfChannels, totalSamples, sampleRate);

    let offset = 0;
    audioBuffers.forEach((buffer) => {
        for (let channel = 0; channel < numberOfChannels; channel++) {
            mergedBuffer.getChannelData(channel).set(buffer.getChannelData(channel), offset);
        }
        offset += buffer.length; 
    });

    return bufferToWave(mergedBuffer);
}

// convert AudioBuffer to WAV Blob
function bufferToWave(buffer) {
    const numOfChan = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const length = buffer.length * numOfChan * 2 + 44;
    const bufferArray = new ArrayBuffer(length);
    const view = new DataView(bufferArray);
    const channels = [];
    let offset = 44;

    function writeString(str, offset) {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    }

    writeString("RIFF", 0);
    view.setUint32(4, 36 + buffer.length * numOfChan * 2, true);
    writeString("WAVE", 8);
    writeString("fmt ", 12);
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numOfChan, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numOfChan * 2, true);
    view.setUint16(32, numOfChan * 2, true);
    view.setUint16(34, 16, true);
    writeString("data", 36);
    view.setUint32(40, buffer.length * numOfChan * 2, true);

    for (let i = 0; i < numOfChan; i++) {
        channels.push(buffer.getChannelData(i));
    }

    for (let i = 0; i < buffer.length; i++) {
        for (let channel = 0; channel < numOfChan; channel++) {
            let sample = Math.max(-1, Math.min(1, channels[channel][i]));
            sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(offset, sample, true);
            offset += 2;
        }
    }

    return new Blob([bufferArray], { type: "audio/wav" });
}

// Event listener
document.getElementById("mergeButton").addEventListener("click", async () => {
    const fileInput = document.getElementById("audioFiles");
    if (fileInput.files.length === 0) {
        alert("Please select MP3 files to merge.");
        return;
    }

    try {
        const mergedBlob = await mergeAudioFiles(fileInput.files);
        const url = URL.createObjectURL(mergedBlob);
        
        const audioContainer = document.getElementById("audioContainer");
        audioContainer.innerHTML = ""; // clear prev audio

        const audio = new Audio(url);
        audio.controls = true;
        audioContainer.appendChild(audio);
    } catch (error) {
        console.error("Error merging audio:", error);
        alert("Failed to merge audio. Check console for details.");
    }
});
