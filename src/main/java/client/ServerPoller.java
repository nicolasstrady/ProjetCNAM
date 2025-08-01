package client;

import javafx.application.Platform;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.function.Predicate;

/**
 * Utility to poll the server asynchronously and notify a listener when the
 * condition is met.
 */
public class ServerPoller {
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();

    public interface Listener {
        void onUpdate(List<Object> response);
    }

    /**
     * Polls the server every second with the given message until the predicate
     * evaluates to true. The listener is called on the JavaFX thread on each
     * poll.
     */
    public void poll(String host, int port, ArrayList<Object> message,
                     Predicate<List<Object>> stopCondition, Listener listener) {
        scheduler.scheduleAtFixedRate(() -> {
            ClientConnexion cl = new ClientConnexion(host, port, message);
            ArrayList<Object> resp = cl.run();
            Platform.runLater(() -> listener.onUpdate(resp));
            if (stopCondition.test(resp)) {
                scheduler.shutdown();
            }
        }, 0, 1, TimeUnit.SECONDS);
    }
}
