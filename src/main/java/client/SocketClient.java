package client;

import java.io.IOException;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.net.Socket;
import java.util.ArrayList;
import java.util.List;

/**
 * Simple wrapper around a persistent socket connection to the server.
 */
public class SocketClient implements AutoCloseable {
    private final Socket socket;
    private final ObjectOutputStream out;
    private final ObjectInputStream in;

    public SocketClient(String host, int port) throws IOException {
        this.socket = new Socket(host, port);
        this.out = new ObjectOutputStream(socket.getOutputStream());
        this.out.flush();
        this.in = new ObjectInputStream(socket.getInputStream());
    }

    @SuppressWarnings("unchecked")
    public synchronized ArrayList<Object> send(List<Object> message) throws IOException, ClassNotFoundException {
        out.writeObject(new ArrayList<>(message));
        out.flush();
        return (ArrayList<Object>) in.readObject();
    }

    @Override
    public void close() throws IOException {
        in.close();
        out.close();
        socket.close();
    }
}
