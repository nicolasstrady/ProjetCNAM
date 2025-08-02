package client;

import javafx.application.Platform;

import java.io.IOException;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.net.Socket;
import java.util.ArrayList;
import java.util.List;

public class ServerListener implements Runnable, AutoCloseable {
    private final Socket socket;
    private final ObjectInputStream in;
    private final ObjectOutputStream out;
    private final Listener listener;

    public interface Listener {
        void onMessage(List<Object> data);
    }

    public ServerListener(String host, int port, Listener listener) throws IOException {
        this.socket = new Socket(host, port);
        this.listener = listener;
        this.out = new ObjectOutputStream(socket.getOutputStream());
        this.out.flush();
        this.in = new ObjectInputStream(socket.getInputStream());
        ArrayList<Object> sub = new ArrayList<>();
        sub.add("SUBSCRIBE");
        out.writeObject(sub);
        out.flush();
    }

    @Override
    public void run() {
        try {
            // Continuously listen for server pushes
            while (!Thread.currentThread().isInterrupted()) {
                Object obj = in.readObject();
                if (obj instanceof List<?>) {
                    List<Object> data = (List<Object>) obj;
                    Platform.runLater(() -> listener.onMessage(data));
                }
            }
        } catch (IOException | ClassNotFoundException e) {
            // connection closed
        }
    }

    @Override
    public void close() throws IOException {
        socket.close();
    }
}
