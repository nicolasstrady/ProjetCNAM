package sample;

import client.SocketClient;
import client.ServerListener;
import javafx.fxml.FXML;
import javafx.fxml.FXMLLoader;
import javafx.scene.Parent;
import javafx.scene.Scene;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.SplitPane;
import javafx.scene.control.TextField;
import javafx.scene.image.Image;
import javafx.scene.image.ImageView;
import javafx.scene.layout.AnchorPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;
import javafx.stage.Stage;

import java.io.IOException;
import java.util.ArrayList;

public class AccueilController {
    @FXML
    private SplitPane splitPane;
    @FXML
    private AnchorPane anchorUser;
    @FXML
    private AnchorPane anchorPlay;
    @FXML
    private Label labelBonjour;
    @FXML
    private VBox boxInfo;
    @FXML
    private Button playButton;
    @FXML
    private Button scoreButton;
    @FXML
    private Button disconnectButton;
    @FXML
    private Label playStatus;
    public static String numJoueur;

    @FXML
    public void disconnect() {
        ConnexionController.stageAccueil.hide();
        ConnexionController.primaryStage.show();
    }

    @FXML
    public void play() throws IOException {
        ArrayList<Object> connects = new ArrayList<>();
        connects.add("PLAYLOBBY");
        connects.add(ConnexionController.idUser);
        ArrayList<Object> lobbyData;
        try {
            lobbyData = ConnexionController.client.send(connects);
        } catch (IOException | ClassNotFoundException e) {
            e.printStackTrace();
            return;
        }

        int count = (int) lobbyData.get(1);
        int nbLeft = (5 - (count % 5)) % 5;
        if (nbLeft == 0) {
            playStatus.setText("Début de la partie");
            startGame(lobbyData);
            return;
        }

        playStatus.setText("En attente de " + nbLeft + " joueurs");
        final ServerListener[] holder = new ServerListener[1];
        holder[0] = new ServerListener(ConnexionController.host, ConnexionController.port, data -> {
            if ("LOBBY_COUNT".equals(data.get(0))) {
                int cnt = (int) data.get(1);
                int left = (5 - (cnt % 5)) % 5;
                if (left == 0) {
                    playStatus.setText("Début de la partie");
                    try {
                        holder[0].close();
                        startGame(lobbyData);
                    } catch (IOException e) {
                        e.printStackTrace();
                    }
                } else {
                    playStatus.setText("En attente de " + left + " joueurs");
                }
            }
        });
        Thread t = new Thread(holder[0]);
        t.setDaemon(true);
        t.start();
    }

    private void startGame(ArrayList<Object> lobbyData) throws IOException {
        ArrayList<Object> plays = new ArrayList<>();
        plays.add("PLAY");
        plays.add(ConnexionController.idUser);
        ArrayList<Object> datas2;
        try {
            datas2 = ConnexionController.client.send(plays);
        } catch (IOException | ClassNotFoundException e) {
            e.printStackTrace();
            return;
        }
        ArrayList<String> idCartes = (ArrayList<String>) datas2.get(0);
        ArrayList<String> lienCartes = (ArrayList<String>) datas2.get(1);
        numJoueur = (String) datas2.get(2);

        ConnexionController.stageAccueil.hide();
        FXMLLoader loader = new FXMLLoader(getClass().getResource("partie.fxml"));
        Parent root = loader.load();
        Stage gameStage = new Stage();
        Scene scene = new Scene(root, 900, 500);
        scene.getStylesheets().add(getClass().getResource("style.css").toString());
        gameStage.setResizable(false);
        gameStage.setTitle("Tarot en ligne");
        gameStage.setScene(scene);
        gameStage.show();

        HBox main = (HBox) root.lookup("#main");
        main.setSpacing(10);
        for (int i = 0; i < idCartes.size(); i++) {
            Image img = new Image(getClass().getResourceAsStream("/sample/img/" + lienCartes.get(i)), 40, 60, false, false);
            ImageView imageCarte = new ImageView(img);
            imageCarte.setId(idCartes.get(i));
            main.getChildren().add(imageCarte);
        }
    }
}
